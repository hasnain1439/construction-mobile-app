/**
 * Site screens (Steps 13, 15, 16, 17) with the munshi's permissions: buttons follow the keys,
 * validation blocks a bad save, and no money is ever on screen (even if a row carried some).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AajScreen from '../app/(tabs)/aaj';
import EquipmentScreen from '../app/maal/equipment';
import MilestoneScreen from '../app/site/milestone';
import NewStoppageScreen from '../app/site/stoppage-new';
import { saveAccess } from '../src/db/access';
import { putRow } from '../src/db/store';
import type { Db } from '../src/db/types';
import type { Ctx } from '../src/features/actions';
import { I18nProvider } from '../src/i18n';
import { pendingItems } from '../src/sync/outbox';
import { testDb } from './helpers/db';

jest.setTimeout(30000);

const P = 'p1';
const LOC = 'loc-site';
let mockDb: Db;
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => mockParams }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('../src/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/features/session', () => ({ useUser: () => ({ id: 'u1', name: 'Rafaqat Ali', role: 'MUNSHI' }) }));
jest.mock('../src/features/project', () => {
  const project = { id: 'p1', name: 'DHA House', code: 'P-1', status: 'ACTIVE', siteAddress: null, city: null };
  return { useProject: () => ({ projectId: 'p1', project, projects: [project], setProjectId: jest.fn() }) };
});
jest.mock('../src/features/useSave', () => ({ useSave: () => (action: (db: Db, c: Ctx) => unknown) => action(mockDb, { userId: 'u1', userName: 'Rafaqat Ali', now: new Date('2026-10-16T09:00:00+05:00') }) }));

const MUNSHI_SITE_KEYS = [
  'schedule.plan.view',
  'schedule.progress.edit',
  'schedule.stoppage.create',
  'changeorder.instruction.create',
  'equipment.view',
  'equipment.receiving.create',
  'equipment.loss.create',
  'closeout.snag.view',
  'closeout.snag.create',
  'closeout.drawing.view',
];
const access = (permissions: string[]) => saveAccess(mockDb, { permissions, fieldAccess: { rates: false, amounts: false, profit: false, contract: false } });

const MILESTONE = {
  id: 'ms-walls',
  projectId: P,
  stageKey: 'F1_STRUCTURE',
  stageName: 'First floor structure',
  key: 'F1_STRUCTURE.WALLS',
  name: 'First floor — columns & brickwork',
  sortOrder: 6,
  plannedStart: '2026-10-08',
  plannedEnd: '2099-10-20',
  durationDays: 10,
  curingDays: 7,
  curingUntil: null,
  status: 'IN_PROGRESS',
  progressPercent: 40,
  actualStart: '2026-10-08',
  actualEnd: null,
  dependsOn: [],
  quotas: [{ materialId: 'cement', material: 'cement', description: 'Cement OPC', unit: 'bag', ownerSupplied: false, plannedQty: 65.29, usedQty: 53, remainingQty: 12.29 }],
  updatedAt: '2026-10-16T07:42:40.907Z',
};

function seed() {
  mockDb = testDb();
  putRow(mockDb, 'projects', { id: P, name: 'DHA House', code: 'P-1', status: 'ACTIVE' });
  putRow(mockDb, 'stock_locations', { id: LOC, type: 'SITE', name: 'DHA site', projectId: P });
  putRow(mockDb, 'materials', { id: 'cement', name: 'Cement', unit: 'bag', groupId: 'g', supplyCategory: 'CONTRACTOR', isHidden: false });
  putRow(mockDb, 'milestones', MILESTONE);
  // Even if a row carried rates / values (an owner's pull), the screens never show them.
  putRow(mockDb, 'equipment', { id: 'eq-mixer', code: 'MX-01', name: 'Concrete mixer', kind: 'MACHINE', category: 'MIXER', unit: 'nos', isActive: true, hireRatePaisaPerDay: '250000', replacementValuePaisa: '45000000' });
  putRow(mockDb, 'equipment_stock', { id: `${LOC}:eq-mixer:own`, locationId: LOC, equipmentId: 'eq-mixer', rentalId: null, quantity: 1 });
  putRow(mockDb, 'equipment_transfers', { id: 'tr-1', number: 'ET-0009', kind: 'DISPATCH', status: 'ON_THE_WAY', fromLocationId: 'yard', toLocationId: LOC, projectId: P, from: 'Central Store', sentAt: null, blindCount: true, items: [{ id: 'i1', equipmentId: 'eq-mixer', rentalId: null, receivedQty: null, damagedQty: null, note: null }] });
  putRow(mockDb, 'equipment_losses', { id: 'el-1', number: 'EL-0001', kind: 'MISSING', status: 'CHARGED', source: 'REPORT', equipmentId: 'eq-mixer', rentalId: null, locationId: LOC, projectId: P, transferId: null, qty: 1, note: 'stolen', reportedAt: '2026-10-11T12:00:00Z', valuePaisa: '45000000' });
}

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const show = (el: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <I18nProvider initial="roman">{el}</I18nProvider>
    </SafeAreaProvider>,
  );
type Node = { children?: (Node | string)[] | null } | string | null;
const textOf = (n: Node | Node[]): string => (n === null ? "" : typeof n === "string" ? n : Array.isArray(n) ? n.map(textOf).join(" ") : (n.children ?? []).map(textOf).join(" "));
/** Every text on screen (the rendered tree, not props). */
const allText = () => textOf(screen.toJSON() as Node | Node[]);

beforeEach(() => {
  mockParams = {};
  seed();
});

describe('Aaj', () => {
  it('shows today’s work with quota left (no money) when the person may see the schedule', async () => {
    access(MUNSHI_SITE_KEYS);
    await show(<AajScreen />);
    expect(screen.getByText('Aaj ka kaam')).toBeTruthy();
    expect(screen.getByText('Pehli manzil ka dhancha — Column aur chunai')).toBeTruthy();
    expect(allText()).toMatch(/Cement: 12\.29 .* baqi/);
    expect(screen.getByLabelText('Kaam ruk gaya')).toBeTruthy();
    expect(screen.getByLabelText('Nayi kharabi')).toBeTruthy();
    expect(allText()).not.toMatch(/Rs\b/);
  });

  it('hides the schedule and the site buttons without their keys', async () => {
    access(['labor.attendance.create']);
    await show(<AajScreen />);
    expect(screen.queryByText('Aaj ka kaam')).toBeNull();
    expect(screen.queryByText('Pehli manzil ka dhancha — Column aur chunai')).toBeNull();
    expect(screen.queryByLabelText('Kaam ruk gaya')).toBeNull();
    expect(screen.queryByLabelText('Nayi hidayat')).toBeNull();
  });
});

describe('Machinery & shuttering', () => {
  it('lists what is on site and on the way — counts only, never rates or values', async () => {
    access(MUNSHI_SITE_KEYS);
    await show(<EquipmentScreen />);
    expect(screen.getAllByText(/Concrete mixer/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('eq-incoming-ET-0009')).toBeTruthy();
    const text = allText();
    expect(text).not.toMatch(/Rs\b|2,500|250000|45000000|4,50,000/);
  });

  it('without the receive key the incoming transfer can’t be opened; without the loss key there is no report button', async () => {
    access(['equipment.view']);
    await show(<EquipmentScreen />);
    expect(screen.queryByLabelText('Gum / toota saaman')).toBeNull();
    expect(screen.queryByText('Saaman mila')).toBeNull();
  });
});

describe('Milestone update', () => {
  it('BLOCKED needs a note before it can be saved; the update goes to the outbox', async () => {
    access(MUNSHI_SITE_KEYS);
    mockParams = { id: 'ms-walls' };
    await show(<MilestoneScreen />);
    await fireEvent.press(screen.getByTestId('status-BLOCKED'));
    expect(screen.getByTestId('save-progress').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Note likhein')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('progress-note'), 'Shuttering nahi aayi');
    await fireEvent.press(screen.getByTestId('save-progress'));
    expect(JSON.parse(pendingItems(mockDb)[0]!.payload)).toEqual({ milestoneId: 'ms-walls', status: 'BLOCKED', note: 'Shuttering nahi aayi', date: '2026-10-16' });
  });

  it('without schedule.progress.edit the progress is read-only', async () => {
    access(['schedule.plan.view']);
    mockParams = { id: 'ms-walls' };
    await show(<MilestoneScreen />);
    expect(screen.queryByTestId('save-progress')).toBeNull();
    expect(screen.getByText('Aap progress dekh sakte hain, badal nahi sakte')).toBeTruthy();
  });
});

describe('Kaam ruk gaya', () => {
  it('rain needs a photo; a holiday does not', async () => {
    access(MUNSHI_SITE_KEYS);
    await show(<NewStoppageScreen />);
    await fireEvent.press(screen.getByTestId('reason-RAIN'));
    expect(screen.getByTestId('save-stoppage').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Photo lagayein')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reason-HOLIDAY'));
    await fireEvent.press(screen.getByTestId('save-stoppage'));
    const [item] = pendingItems(mockDb);
    expect(item!.type).toBe('STOPPAGE_LOG');
    expect(JSON.parse(item!.payload)).toMatchObject({ projectId: P, reason: 'HOLIDAY', dates: [expect.any(String)] });
  });
});
