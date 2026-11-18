/**
 * Live updates on the phone: while the app is on screen, the API's /realtime/stream
 * (Server-Sent Events) says when someone changed something in the company — the office or
 * another phone — and the phone syncs, so new entries show up without pull-to-refresh.
 *
 * The server hands a change to phones only once it is `syncLagMs` old (the safe sync cursor,
 * 30 s), so the pull runs that long after the event; several events close together → one sync.
 * The app's own pushes come back with its X-Client-Id and are skipped. In the background the
 * stream is closed (battery); the existing foreground / network / periodic syncs cover that.
 *
 * Reconnects: the API ends a stream after ~10 minutes, or after a few on serverless hosting
 * (REALTIME_MAX_STREAM_SECONDS, announced by a `reconnect` event); the phone reconnects at once.
 * When the server numbers its messages (`id:`) the phone sends the last one back
 * (Last-Event-ID) and the server replays the changes announced in between (or sends
 * `resource: "*"`), so a sync still follows every change.
 */
import { fetch as expoFetch } from 'expo/fetch';
import { AppState } from 'react-native';
import { CLIENT_ID, CLIENT_ID_HEADER } from '../api/clientId';
import { refreshTokens } from '../api/client';
import { API_BASE_URL } from '../api/config';
import { ENDPOINTS } from '../api/endpoints';
import { getTokens } from '../api/session';
import { syncFromApp } from './triggers';

const RETRY_DELAYS_MS = [1_000, 3_000, 10_000, 30_000] as const;
const DISABLED_RETRY_MS = 5 * 60_000;
const DEFAULT_SYNC_LAG_MS = 30_000;
/** Clock and network slack on top of the server's lag. */
const SYNC_MARGIN_MS = 2_000;

export interface SseMessage {
  event: string;
  data: string;
  /** The stream's last event id when this message arrived (only when the server sends ids). */
  id?: string;
}

/** Incremental text/event-stream parser: feed it chunks, get complete messages back. */
export function sseParser() {
  let buffer = '';
  /** Last `id:` seen, also from blocks without data (pings); null = none yet. */
  let lastEventId: string | null = null;
  const parse = (chunk: string): SseMessage[] => {
    buffer += chunk.replace(/\r\n?/g, '\n');
    const out: SseMessage[] = [];
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (!line || line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'event') event = value;
        else if (field === 'data') data.push(value);
        else if (field === 'id' && !value.includes('\0')) lastEventId = value;
      }
      if (!data.length) continue;
      const message: SseMessage = { event, data: data.join('\n') };
      if (lastEventId !== null) message.id = lastEventId;
      out.push(message);
    }
    return out;
  };
  return Object.assign(parse, { lastEventId: () => lastEventId });
}

export interface LiveSyncDeps {
  fetchFn: typeof expoFetch;
  sync: () => Promise<unknown>;
  now: () => number;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

/** Sync at `due` at the latest; events while waiting / syncing share one run (plus one for later ones). */
function syncScheduler(deps: LiveSyncDeps) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latestDue = 0;
  const fire = async () => {
    timer = undefined;
    await deps.sync().catch(() => undefined);
    if (!timer && latestDue > deps.now()) timer = setTimeout(() => void fire(), latestDue - deps.now());
  };
  return {
    syncAt(due: number) {
      latestDue = Math.max(latestDue, due);
      if (!timer) timer = setTimeout(() => void fire(), Math.max(0, due - deps.now()));
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}

async function runStream(signal: AbortSignal, deps: LiveSyncDeps, onChange: (syncLagMs: number) => void) {
  let failures = 0;
  let missed = false;
  let syncLagMs = DEFAULT_SYNC_LAG_MS;
  /** Last id of a server that numbers its messages: everything up to it was received. */
  let lastEventId: string | null = null;
  const syncMissed = () => {
    onChange(0);
    onChange(syncLagMs);
  };
  while (!signal.aborted) {
    let wait: number = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)]!;
    try {
      const tokens = await getTokens();
      if (!tokens) return;
      const resumeFrom = lastEventId;
      const res = await deps.fetchFn(`${API_BASE_URL}${ENDPOINTS.realtimeStream}`, {
        headers: {
          accept: 'text/event-stream',
          authorization: `Bearer ${tokens.accessToken}`,
          [CLIENT_ID_HEADER]: CLIENT_ID,
          ...(resumeFrom === null ? {} : { 'last-event-id': resumeFrom }),
        },
        signal,
      });
      if (res.status === 401) {
        failures += 1;
        // Access token expired: rotate it and reconnect at once (twice at most, then back off).
        if (failures <= 2 && (await refreshTokens())) continue;
      } else if (res.status === 503 && ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code === 'REALTIME_DISABLED') {
        wait = DISABLED_RETRY_MS;
      } else if (res.ok && res.body) {
        failures = 0;
        // Back after a failure: changes made meanwhile were never announced (sync now, and once
        // more when the youngest of them can be pulled) — unless the server replays them (it got
        // our Last-Event-ID; `ready` shows whether it numbers its messages).
        let unsure = missed && resumeFrom !== null;
        if (missed && resumeFrom === null) syncMissed();
        missed = false;
        const parse = sseParser();
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let reconnect = false;
        while (!reconnect) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const message of parse(decoder.decode(value, { stream: true }))) {
            if (message.event === 'ready') {
              const lag = (JSON.parse(message.data) as { syncLagMs?: unknown }).syncLagMs;
              if (typeof lag === 'number' && lag >= 0) syncLagMs = lag;
              if (message.id === undefined) {
                // This server does not number its messages (any more): it replays nothing.
                lastEventId = null;
                if (unsure) syncMissed();
              }
              unsure = false;
            } else if (message.event === 'change') {
              const { origin } = JSON.parse(message.data) as { origin?: unknown };
              if (origin !== CLIENT_ID) onChange(syncLagMs);
            } else if (message.event === 'reconnect') {
              // The server's time is up (serverless): it closes now — come back at once.
              reconnect = true;
            }
          }
          const id = parse.lastEventId();
          if (id !== null) lastEventId = id;
        }
        if (reconnect) await reader.cancel().catch(() => undefined);
        // Ended before `ready` said whether the server replays: still unsure on the next try.
        if (unsure) missed = true;
        // The server ends a stream after a while (~10 minutes; a few on serverless): reconnect at
        // once. With Last-Event-ID the server first replays what was announced while away.
        continue;
      } else {
        failures += 1;
      }
    } catch {
      if (signal.aborted) return;
      failures += 1;
    }
    missed = true;
    await sleep(wait, signal);
  }
}

/** Call once signed in and set up; returns the function that stops live updates. */
export function startLiveSync(deps: LiveSyncDeps = { fetchFn: expoFetch, sync: syncFromApp, now: Date.now }): () => void {
  const scheduler = syncScheduler(deps);
  let abort: AbortController | null = null;
  const start = () => {
    if (abort) return;
    const current = new AbortController();
    abort = current;
    void runStream(current.signal, deps, (lag) => scheduler.syncAt(deps.now() + (lag ? lag + SYNC_MARGIN_MS : 0))).finally(() => {
      if (abort === current) abort = null;
    });
  };
  const stop = () => {
    abort?.abort();
    abort = null;
  };
  const appState = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
  if (AppState.currentState === 'active' || AppState.currentState == null) start();
  return () => {
    appState.remove();
    stop();
    scheduler.cancel();
  };
}
