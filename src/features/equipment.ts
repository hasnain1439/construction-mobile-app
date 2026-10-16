/**
 * Step 16 on the phone: equipment on site (owned vs rented — counts only), receiving a transfer
 * with counts (EQUIPMENT_RECEIVE; with blind count the sent quantity stays hidden) and reporting
 * missing / damaged equipment (EQUIPMENT_LOSS_REPORT). The server never sends a munshi rates or values.
 */
import { getRow, listRows } from '../db/store';
import type { Db } from '../db/types';
import { todayPK } from '../lib/dates';
import { uuidv7 } from '../lib/uuid';
import { enqueue, type Write } from '../sync/outbox';
import type { Ctx } from './actions';
import { siteLocation } from './queries';
import type { EquipmentLossKind, EquipmentLossRow, EquipmentRentalRow, EquipmentRow, EquipmentStockRow, EquipmentTransferItem, EquipmentTransferRow } from './types';

const nowOf = (c: Ctx) => c.now ?? new Date();
const round = (n: number) => Math.round(n * 1000) / 1000;

export const equipmentMap = (db: Db) => new Map(listRows<EquipmentRow>(db, 'equipment').map((e) => [e.id, e]));
export const stockId = (locationId: string, equipmentId: string, rentalId: string | null) => `${locationId}:${equipmentId}:${rentalId ?? 'own'}`;

export type SiteEquipment = EquipmentStockRow & { equipment: EquipmentRow | undefined; rental: EquipmentRentalRow | undefined };

/** What is on this site now (quantity > 0), owned and rented lines apart. */
export function siteEquipment(db: Db, projectId: string): SiteEquipment[] {
  const loc = siteLocation(db, projectId);
  if (!loc) return [];
  const eq = equipmentMap(db);
  const rentals = new Map(listRows<EquipmentRentalRow>(db, 'equipment_rentals').map((r) => [r.id, r]));
  return listRows<EquipmentStockRow>(db, 'equipment_stock')
    .filter((s) => s.locationId === loc.id && s.quantity > 0)
    .map((s) => ({ ...s, equipment: eq.get(s.equipmentId), rental: s.rentalId ? rentals.get(s.rentalId) : undefined }))
    .sort((a, b) => (a.equipment?.name ?? '').localeCompare(b.equipment?.name ?? '') || (a.rentalId ? 1 : 0) - (b.rentalId ? 1 : 0));
}

/** Transfers on the way TO this site (a return from the site is the yard's to receive). */
export function incomingEquipment(db: Db, projectId: string): EquipmentTransferRow[] {
  const loc = siteLocation(db, projectId);
  return listRows<EquipmentTransferRow>(db, 'equipment_transfers')
    .filter((t) => t.status === 'ON_THE_WAY' && (loc ? t.toLocationId === loc.id : t.projectId === projectId && t.kind !== 'RETURN'))
    .sort((a, b) => (a.sentAt ?? '').localeCompare(b.sentAt ?? ''));
}

export const equipmentLosses = (db: Db, projectId: string) => listRows<EquipmentLossRow>(db, 'equipment_losses', projectId).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));

/**
 * Hide the sent quantity while counting: the server marks the transfer `blindCount` (company
 * setting "blind count" on, for a munshi) and leaves `sentQty` out; a missing quantity is blind too.
 */
export const hidesSentQty = (t: EquipmentTransferRow) => t.status === 'ON_THE_WAY' && (t.blindCount || t.items.some((i) => i.sentQty === undefined || i.sentQty === null));

export interface ReceiveLine {
  itemId: string;
  received: number;
  damaged: number;
  note?: string;
  photoId?: string;
}

export type ReceiveError = 'VALIDATION_ERROR' | 'DAMAGED_EXCEEDS_COUNTED' | 'RECEIVED_EXCEEDS_SENT' | 'NOTE_REQUIRED';

/**
 * One counted line, with the server's rules: damaged ≤ received; not more than was sent; a note
 * when short or damaged. Blind: the phone can't know the gap — a short count without a note can
 * still come back as NOTE_REQUIRED (the munshi is asked to write a note when something looks short).
 */
export function checkReceiveLine(item: EquipmentTransferItem, line: Omit<ReceiveLine, 'itemId'>, blind: boolean): ReceiveError | null {
  if (!Number.isFinite(line.received) || line.received < 0 || !Number.isFinite(line.damaged) || line.damaged < 0) return 'VALIDATION_ERROR';
  if (line.damaged > line.received) return 'DAMAGED_EXCEEDS_COUNTED';
  const sent = blind ? null : (item.sentQty ?? null);
  if (sent !== null && line.received > sent) return 'RECEIVED_EXCEEDS_SENT';
  const short = sent !== null && line.received < sent;
  if ((short || line.damaged > 0) && !line.note?.trim()) return 'NOTE_REQUIRED';
  return null;
}

/** Counted at the gate: the site balance goes up at once (damaged pieces are on site too); the gap comes from the server. */
export function receiveEquipment(db: Db, c: Ctx, t: EquipmentTransferRow, lines: ReceiveLine[], note?: string) {
  const now = nowOf(c);
  const blind = hidesSentQty(t);
  for (const item of t.items) {
    const l = lines.find((x) => x.itemId === item.id);
    if (!l) throw new Error('ITEMS_MISMATCH');
    const err = checkReceiveLine(item, l, blind);
    if (err) throw new Error(err);
  }
  const gap = !blind && t.items.some((i) => {
    const l = lines.find((x) => x.itemId === i.id)!;
    return (i.sentQty ?? 0) > l.received || l.damaged > 0;
  });
  const items = t.items.map((i) => {
    const l = lines.find((x) => x.itemId === i.id)!;
    return { ...i, receivedQty: l.received, damagedQty: l.damaged, note: l.note?.trim() || null };
  });
  const writes: Write[] = [{ table: 'equipment_transfers', row: { ...t, items, status: gap ? 'RECEIVED_WITH_GAP' : 'RECEIVED', pendingSync: true } }];
  for (const i of t.items) {
    const l = lines.find((x) => x.itemId === i.id)!;
    if (!l.received) continue;
    const id = stockId(t.toLocationId, i.equipmentId, i.rentalId);
    const prev = getRow<EquipmentStockRow>(db, 'equipment_stock', id) ?? { id, locationId: t.toLocationId, equipmentId: i.equipmentId, rentalId: i.rentalId, quantity: 0 };
    const already = writes.find((w) => w.table === 'equipment_stock' && w.row.id === id);
    if (already) already.row = { ...already.row, quantity: round((already.row['quantity'] as number) + l.received) };
    else writes.push({ table: 'equipment_stock', row: { ...prev, quantity: round(prev.quantity + l.received) } });
  }
  const trimmed = note?.trim();
  return enqueue(
    db,
    {
      type: 'EQUIPMENT_RECEIVE',
      payload: {
        transferId: t.id,
        date: todayPK(now),
        ...(trimmed ? { note: trimmed } : {}),
        items: lines.map((l) => ({
          itemId: l.itemId,
          receivedQty: l.received,
          ...(l.damaged ? { damagedQty: l.damaged } : {}),
          ...(l.note?.trim() ? { note: l.note.trim() } : {}),
          ...(l.photoId ? { photoAttachmentId: l.photoId } : {}),
        })),
      },
      label: t.number,
      writes,
    },
    now,
  );
}

export interface LossInput {
  projectId: string;
  equipmentId: string;
  rentalId: string | null;
  kind: EquipmentLossKind;
  qty: number;
  note: string;
  photoId?: string | null;
}

export type LossError = 'VALIDATION_ERROR' | 'INSUFFICIENT_EQUIPMENT' | 'NOTE_REQUIRED' | 'PHOTO_REQUIRED';

/** qty > 0 and not more than is on site; a note (3+ letters); a photo of damaged equipment. */
export function checkLoss(input: Omit<LossInput, 'projectId' | 'equipmentId' | 'rentalId'>, onSite: number): LossError | null {
  if (!Number.isFinite(input.qty) || input.qty <= 0) return 'VALIDATION_ERROR';
  if (input.qty > onSite) return 'INSUFFICIENT_EQUIPMENT';
  if (input.note.trim().length < 3) return 'NOTE_REQUIRED';
  if (input.kind === 'DAMAGED' && !input.photoId) return 'PHOTO_REQUIRED';
  return null;
}

/** Missing equipment leaves the site balance at once; damaged stays on site (the office decides who pays). */
export function reportEquipmentLoss(db: Db, c: Ctx, input: LossInput) {
  const now = nowOf(c);
  const loc = siteLocation(db, input.projectId);
  const sid = loc ? stockId(loc.id, input.equipmentId, input.rentalId) : null;
  const stock = sid ? getRow<EquipmentStockRow>(db, 'equipment_stock', sid) : null;
  const err = checkLoss(input, stock?.quantity ?? 0);
  if (err) throw new Error(err);
  const clientId = uuidv7(now.getTime());
  const note = input.note.trim();
  const row: EquipmentLossRow = {
    id: clientId,
    clientId,
    number: '—',
    kind: input.kind,
    status: 'REPORTED',
    source: 'REPORT',
    equipmentId: input.equipmentId,
    rentalId: input.rentalId,
    locationId: loc?.id ?? null,
    projectId: input.projectId,
    transferId: null,
    qty: input.qty,
    note,
    reportedAt: now.toISOString(),
    pendingSync: true,
  };
  const writes: Write[] = [{ table: 'equipment_losses', row }];
  if (stock && input.kind === 'MISSING') writes.push({ table: 'equipment_stock', row: { ...stock, quantity: round(stock.quantity - input.qty) } });
  const name = getRow<EquipmentRow>(db, 'equipment', input.equipmentId)?.name ?? '';
  return enqueue(
    db,
    {
      clientId,
      type: 'EQUIPMENT_LOSS_REPORT',
      payload: {
        projectId: input.projectId,
        equipmentId: input.equipmentId,
        ...(input.rentalId ? { rentalId: input.rentalId } : {}),
        kind: input.kind,
        qty: input.qty,
        note,
        ...(input.photoId ? { photoAttachmentId: input.photoId } : {}),
        date: todayPK(now),
      },
      label: `${name} × ${input.qty}`,
      writes,
    },
    now,
  );
}

/** Icon per equipment category (MaterialCommunityIcons names). */
export const EQUIPMENT_ICON: Record<EquipmentRow['category'], string> = {
  SHUTTERING_PLATE: 'view-grid-outline',
  PROP: 'format-vertical-align-center',
  SCAFFOLDING: 'ladder',
  MIXER: 'blender-outline',
  VIBRATOR: 'vibrate',
  GENERATOR: 'engine-outline',
  PUMP: 'water-pump',
  TOOL: 'tools',
  OTHER: 'toolbox-outline',
};
