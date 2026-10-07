/** A scripted stand-in for the server: tests queue pull pages and decide each push result. */
import type { PullResponse, PushMutation, PushResult, SyncApi, UploadItem } from '../../src/sync/api';

export type Decide = (m: PushMutation) => Partial<PushResult> & { status: PushResult['status'] };

export class FakeApi implements SyncApi {
  pulls: PullResponse[] = [];
  pullCursors: (string | undefined)[] = [];
  pushed: PushMutation[][] = [];
  pendingHeaders: number[] = [];
  uploads: UploadItem[] = [];
  decide: Decide = (m) => ({ status: 'APPLIED', serverId: `srv-${m.clientId}` });
  pushError: Error | null = null;
  uploadError: Error | null = null;

  page(changes: PullResponse['changes'], over: Partial<PullResponse> = {}): this {
    this.pulls.push({ cursor: String(this.pulls.length + 1), hasMore: false, resetRequired: false, serverTime: new Date(0).toISOString(), changes, ...over });
    return this;
  }

  async pull(cursor: string | undefined): Promise<PullResponse> {
    this.pullCursors.push(cursor);
    const next = this.pulls.shift();
    return next ?? { cursor: cursor ?? '0', hasMore: false, resetRequired: false, serverTime: new Date(0).toISOString(), changes: {} };
  }

  async push(mutations: PushMutation[], pending: number): Promise<{ results: PushResult[] }> {
    if (this.pushError) throw this.pushError;
    this.pushed.push(mutations);
    this.pendingHeaders.push(pending);
    return {
      results: mutations.map((m) => {
        const r = this.decide(m);
        return { clientId: m.clientId, type: m.type, serverId: null, error: null, ...r };
      }),
    };
  }

  async upload(item: UploadItem) {
    if (this.uploadError) throw this.uploadError;
    this.uploads.push(item);
    return { id: `att-${item.clientId}` };
  }
}
