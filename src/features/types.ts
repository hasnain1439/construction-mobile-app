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
export type WorkerType = 'MISTRI' | 'MISTRI_TILES' | 'MAZDOOR' | 'STEEL_FIXER_HELPER' | 'CHOWKIDAR' | 'OTHER';
export const WORKER_TYPES: WorkerType[] = ['MISTRI', 'MAZDOOR', 'MISTRI_TILES', 'STEEL_FIXER_HELPER', 'CHOWKIDAR', 'OTHER'];
export type WorkerRow = Base & { name: string; type: WorkerType; phone: string | null; dailyRatePaisa: string | null; isActive: boolean };
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
