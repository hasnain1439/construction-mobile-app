/**
 * Shapes of the rows mirrored from /sync/pull (see the server's sync.serializers.ts). Rows
 * written on the phone before the server confirmed them carry `pendingSync: true`.
 * By design there are no material rates, purchase amounts, supplier details or contract values.
 */
import type { Row } from '../db/store';

type Base = Row & { pendingSync?: boolean };

export type ProjectRow = Base & { code: string; name: string; status: string; siteAddress: string | null; city: string | null };
export type LocationRow = Base & { type: string; name: string; projectId: string | null };
export type MaterialRow = Base & { name: string; unit: string; groupId: string; supplyCategory: string; isHidden: boolean };
export type MaterialGroupRow = Base & { code: string; name: string; sortOrder: number };
export type SupplierRow = Base & { name: string };
/** A company worker type (a DAILY labour rate); `key` is what `WorkerRow.type` holds. */
export type WorkerTypeRow = Base & { key: string; label: string; labelRoman: string | null; labelUrdu: string | null; ratePaisa: string; overtimeMultiplier: number | null; isActive: boolean; updatedAt: string };
/** A worker_types `key`, or 'OTHER'. */
export type WorkerType = string;
export type WorkerRow = Base & { name: string; type: WorkerType; typeLabel?: string | null; typeLabelRoman?: string | null; typeLabelUrdu?: string | null; phone: string | null; dailyRatePaisa: string | null; isActive: boolean };
export type ProjectWorkerRow = Base & { projectId: string; workerId: string; dailyRatePaisa: string | null; startDate: string | null; endDate: string | null; isActive: boolean };
export type AssignmentRow = Base & { projectId: string; subcontractor: { id: string; name: string; trade: string }; scope: string; rateType: string; unit: string; progressPercent: number | null; isActive: boolean };
export type AttendanceStatus = 'FULL' | 'HALF' | 'ABSENT';
export type AttendanceRow = Base & { projectId: string; workerId: string; date: string; status: AttendanceStatus; overtimeHours: number | null; note: string | null; clientId: string | null; lateSync?: boolean };
export type SettlementLine = { id: string; workerId: string; fullDays: number; halfDays: number; daysWorked: number | null; dailyRatePaisa: string | null; overtimeHours: number | null; overtimePaisa: string | null; grossPaisa: string | null; advanceAdjustedPaisa: string | null; netPaisa: string | null; paymentStatus: string; paidFrom: string | null };
export type SettlementRow = Base & { projectId: string; weekStart: string; weekEnd: string; status: string; grossPaisa: string | null; advancePaisa: string | null; netPaisa: string | null; paidPaisa: string | null; returnComment: string | null; lines: SettlementLine[] };
export type AdvanceRow = Base & { projectId: string; payeeType: 'WORKER' | 'SUBCONTRACTOR'; workerId: string | null; assignmentId: string | null; amountPaisa: string; date: string; paidFrom: string; note: string | null };
export type MeasurementRow = Base & { projectId: string; assignmentId: string; date: string; description: string; quantity: number; unit: string; status: string; note: string | null; attachmentIds: string[] };
export type ReceiveItem = { id: string; materialId: string; sentQty?: number | null; challanQty?: number | null; receivedQty?: number | null; countedQty?: number | null; damagedQty: number | null; note: string | null };
export type DispatchRow = Base & { number: string; status: string; projectId: string | null; toLocationId: string; from: string; vehicleNo: string | null; driverName: string | null; driverPhone: string | null; dispatchedAt: string | null; receivedAt: string | null; blindCount: boolean; items: ReceiveItem[] };
export type PurchaseRow = Base & { number: string; status: string; projectId: string | null; locationId: string; supplier: { id: string; name: string }; challanNo: string; vehicleNo: string | null; purchaseDate: string; receivedAt: string | null; mine: boolean; blindCount: boolean; items: ReceiveItem[] };
export type OwnerDeliveryRow = Base & { projectId: string; locationId: string; deliveryDate: string; note: string | null; photoAttachmentIds: string[]; items: { id: string; materialId: string; quantity: number }[] };
export type UsageRow = Base & { projectId: string; locationId: string; usageDate: string; note: string | null; createdById: string | null; items: { id: string; materialId: string; quantity: number }[] };
export type SiteStockRow = Base & { locationId: string; materialId: string; quantity: number; ownerQuantity: number };
export type StockCountRow = Base & { number: string; locationId: string; countedAt: string; note: string | null; items: { id: string; materialId: string; systemQty: number | null; countedQty: number; difference: number | null; reason: string | null }[] };
export type SiteCondition = 'NORMAL' | 'RAIN' | 'POWER_CUT' | 'WATER_SHORTAGE' | 'CURING' | 'LABOUR_SHORT' | 'MATERIAL_SHORT' | 'OTHER';
export const SITE_CONDITIONS: SiteCondition[] = ['NORMAL', 'RAIN', 'POWER_CUT', 'WATER_SHORTAGE', 'CURING', 'LABOUR_SHORT', 'MATERIAL_SHORT', 'OTHER'];
export type DailyLogRow = Base & { projectId: string; logDate: string; note: string | null; conditions: SiteCondition[]; workDone: string | null; photoAttachmentIds: string[]; voiceAttachmentIds: string[]; authorId: string; authorName: string; clientId: string | null; lateSync?: boolean };
export type CashAccountRow = Base & { name: string; isActive: boolean; balancePaisa: string; pendingAckPaisa: string; pendingApprovalPaisa: string; recoverablePaisa: string };
export type ExpenseCategory = 'TEA_WATER' | 'TRANSPORT' | 'UNLOADING' | 'FUEL' | 'SMALL_TOOLS' | 'URGENT_MATERIAL' | 'OWNER_PURCHASE' | 'REPAIRS' | 'OTHER';
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['TEA_WATER', 'TRANSPORT', 'UNLOADING', 'FUEL', 'SMALL_TOOLS', 'URGENT_MATERIAL', 'OWNER_PURCHASE', 'REPAIRS', 'OTHER'];
export type CashEntryRow = Base & { accountId: string; projectId: string | null; type: string; amountPaisa: string; category: ExpenseCategory | null; description: string; status: string; method: string | null; reviewNote: string | null; recoverableFromHolder: boolean; attachmentId: string | null; clientId: string | null; occurredAt: string | null; lateSync?: boolean };
export type TopupRow = Base & { accountId: string; amountPaisa: string; note: string | null; status: string; decisionNote: string | null; createdAt: string | null };
export type SettingsRow = Base & { blindCountEnabled: boolean; kharchaApprovalLimitPaisa: string; workingDays: string[]; settlementWeekStart: string; hoursPerDay: number; missingLogAlertTime: string };
export type HolidayRow = Base & { startDate: string; endDate: string | null; name: string; type: string };
export type NotificationRow = Base & { type: string; severity: string; title: string; body: string; projectId: string | null; read: boolean; createdAt: string };

// ─── Phase 2 + 3 (Steps 13, 15, 16, 17): quantities, statuses and photos only — never money ──────

/** Step 13 · schedule. */
export type MilestoneStatus = 'PLANNED' | 'IN_PROGRESS' | 'CURING' | 'DONE' | 'BLOCKED';
export const MILESTONE_STATUSES: MilestoneStatus[] = ['PLANNED', 'IN_PROGRESS', 'CURING', 'DONE', 'BLOCKED'];
export type StageKey = 'FOUNDATION_PLINTH' | 'GF_STRUCTURE' | 'F1_STRUCTURE' | 'F2_STRUCTURE' | 'F3_STRUCTURE' | 'MUMTY_ROOF' | 'PLASTER_MEP' | 'FINISHING';
export type QuotaLine = { materialId: string | null; material: string; description: string; unit: string; ownerSupplied: boolean; plannedQty: number; usedQty: number; remainingQty: number };
export type MilestoneRow = Base & {
  projectId: string;
  stageKey: StageKey | string;
  stageName: string;
  key: string;
  name: string;
  sortOrder: number;
  plannedStart: string;
  plannedEnd: string;
  durationDays: number;
  curingDays: number;
  curingUntil: string | null;
  status: MilestoneStatus;
  progressPercent: number;
  actualStart: string | null;
  actualEnd: string | null;
  dependsOn: { milestoneId: string; type: 'FS' | 'SS'; lagDays: number }[];
  quotas: QuotaLine[];
  updatedAt: string;
};
export type StoppageReason = 'RAIN' | 'SMOG_BAN' | 'HOLIDAY' | 'OWNER_HOLD' | 'MATERIAL_SHORT' | 'LABOUR_SHORT' | 'OTHER';
export const STOPPAGE_REASONS: StoppageReason[] = ['RAIN', 'SMOG_BAN', 'HOLIDAY', 'OWNER_HOLD', 'MATERIAL_SHORT', 'LABOUR_SHORT', 'OTHER'];
export type StoppageRow = Base & {
  projectId: string;
  dates: string[];
  reason: StoppageReason;
  category: 'OWNER' | 'EXCUSABLE' | 'CONTRACTOR';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string | null;
  photoAttachmentIds: string[];
  clientId: string | null;
  reportedById: string | null;
  reportedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

/** Step 15 · the owner's instruction on site, for the office to turn into a change order. */
export type SiteInstructionStatus = 'NEW' | 'CONVERTED' | 'DISMISSED';
export type SiteInstructionRow = Base & {
  projectId: string;
  number: number | null;
  code: string | null;
  note: string;
  photoIds: string[];
  status: SiteInstructionStatus;
  changeOrderId: string | null;
  changeOrderCode: string | null;
  dismissReason: string | null;
  clientId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Step 16 · equipment & shuttering (rates / values are never sent to a munshi). */
export type EquipmentCategory = 'SHUTTERING_PLATE' | 'PROP' | 'SCAFFOLDING' | 'MIXER' | 'VIBRATOR' | 'GENERATOR' | 'PUMP' | 'TOOL' | 'OTHER';
export type EquipmentRow = Base & { code: string; name: string; kind: 'MACHINE' | 'BULK'; category: EquipmentCategory; unit: string; isActive: boolean };
/** id = "<locationId>:<equipmentId>:<rentalId|own>". */
export type EquipmentStockRow = Base & { locationId: string; equipmentId: string; rentalId: string | null; quantity: number };
export type EquipmentTransferItem = { id: string; equipmentId: string; rentalId: string | null; sentQty?: number | null; receivedQty: number | null; damagedQty: number | null; note: string | null };
export type EquipmentTransferRow = Base & {
  number: string;
  kind: 'DISPATCH' | 'TRANSFER' | 'RETURN';
  status: 'ON_THE_WAY' | 'RECEIVED' | 'RECEIVED_WITH_GAP' | 'CANCELLED';
  fromLocationId: string;
  toLocationId: string;
  projectId: string | null;
  from: string;
  sentAt: string | null;
  blindCount: boolean;
  items: EquipmentTransferItem[];
};
export type EquipmentRentalRow = Base & {
  number: string;
  status: string;
  supplierName: string;
  projectId: string | null;
  locationId: string;
  startDate: string;
  expectedEndDate: string | null;
  items: { id: string; equipmentId: string; qty: number; returnedQty: number; missingQty: number }[];
};
export type EquipmentLossKind = 'MISSING' | 'DAMAGED';
export type EquipmentLossRow = Base & {
  number: string;
  kind: EquipmentLossKind;
  status: 'REPORTED' | 'CHARGED';
  source: 'REPORT' | 'TRANSFER_GAP';
  equipmentId: string;
  rentalId: string | null;
  locationId: string | null;
  projectId: string | null;
  transferId: string | null;
  qty: number;
  note: string | null;
  reportedAt: string;
};

/** Step 17 · closeout. */
export type SnagStatus = 'OPEN' | 'FIXED' | 'VERIFIED';
export const SNAG_STATUSES: SnagStatus[] = ['OPEN', 'FIXED', 'VERIFIED'];
export type SnagRow = Base & {
  projectId: string;
  number: number | null;
  code: string | null;
  roomId: string | null;
  location: string | null;
  description: string;
  status: SnagStatus;
  targetDate: string | null;
  inDefectPeriod: boolean;
  assigneeType: 'WORKER' | 'SUBCONTRACTOR' | null;
  workerId: string | null;
  subcontractorId: string | null;
  beforePhotoIds: string[];
  afterPhotoIds: string[];
  fixNote: string | null;
  fixedAt: string | null;
  verifiedAt: string | null;
  clientId: string | null;
  createdById: string | null;
  updatedAt: string;
};
export type DrawingFolder = 'ARCHITECTURAL' | 'STRUCTURAL' | 'MEP' | 'SOCIETY_APPROVED' | 'OTHER';
export const DRAWING_FOLDERS: DrawingFolder[] = ['ARCHITECTURAL', 'STRUCTURAL', 'MEP', 'SOCIETY_APPROVED', 'OTHER'];
export type DrawingRow = Base & {
  projectId: string;
  folder: DrawingFolder;
  title: string;
  number: string | null;
  latestRevisionId: string | null;
  latestRevisionNo: number | null;
  latestAttachmentId: string | null;
  latestApprovedAt: string | null;
  revisionCount: number;
  updatedAt: string;
};
