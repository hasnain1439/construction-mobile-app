import { fireEvent, render, screen } from '@testing-library/react-native';
import NewWorkerScreen from '../app/hazri/worker-new';
import { saveAccess } from '../src/db/access';
import { putRow } from '../src/db/store';
import type { Db } from '../src/db/types';
import type { Ctx } from '../src/features/actions';
import { I18nProvider, type Language } from '../src/i18n';
import { pendingItems } from '../src/sync/outbox';
import { testDb } from './helpers/db';

jest.setTimeout(30000); // the first render loads the whole screen tree

let mockDb: Db;
let mockRole = 'THEKEDAR';
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('../src/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/features/session', () => ({ useUser: () => ({ id: 'u1', name: 'Rafaqat', role: mockRole }) }));
jest.mock('../src/features/project', () => ({ useProject: () => ({ projectId: 'p1' }) }));
jest.mock('../src/features/useSave', () => ({ useSave: () => (action: (db: Db, c: Ctx) => unknown) => action(mockDb, { userId: 'u1', userName: 'Rafaqat' }) }));

const wt = (key: string, label: string, labelRoman: string | null, labelUrdu: string | null, ratePaisa: string, isActive = true) => ({
  id: `wt-${key}`,
  key,
  label,
  labelRoman,
  labelUrdu,
  ratePaisa,
  overtimeMultiplier: null,
  isActive,
  updatedAt: '2026-10-01T09:00:00.000Z',
});

function seed(withTypes = true) {
  mockDb = testDb();
  if (!withTypes) return;
  putRow(mockDb, 'worker_types', wt('MISTRI', 'Mason', 'Mistri', 'مستری', '280000'));
  putRow(mockDb, 'worker_types', wt('MAZDOOR', 'Labourer', 'Mazdoor', null, '180050'));
  putRow(mockDb, 'worker_types', wt('ELECTRICIAN', 'Electrician', null, null, '300000', false));
}

const show = (language: Language) =>
  render(
    <I18nProvider initial={language}>
      <NewWorkerScreen />
    </I18nProvider>,
  );

beforeEach(() => {
  mockRole = 'THEKEDAR';
});

describe('Naya mazdoor', () => {
  it('offers the synced active types in Urdu (falling back to Roman), plus Other', async () => {
    seed();
    await show('ur');
    expect(screen.getByText('مستری')).toBeTruthy();
    expect(screen.getByText('Mazdoor')).toBeTruthy();
    expect(screen.getByText('دیگر')).toBeTruthy();
    expect(screen.queryByTestId('worker-type-ELECTRICIAN')).toBeNull();
  });

  it('shows English names in English', async () => {
    seed();
    await show('en');
    expect(screen.getByText('Mason')).toBeTruthy();
    expect(screen.getByText('Labourer')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
  });

  it('works before the first sync with the built-in list', async () => {
    seed(false);
    await show('roman');
    expect(screen.getByTestId('worker-type-MISTRI')).toBeTruthy();
    expect(screen.getByTestId('worker-type-MAZDOOR')).toBeTruthy();
    expect(screen.getByText('Deegar')).toBeTruthy();
  });

  it('choosing a type fills an empty rate, never a typed one, and sends the type key', async () => {
    seed();
    await show('roman');
    const rate = () => screen.getByTestId('worker-rate').props.value as string;
    expect(rate()).toBe('');
    await fireEvent.press(screen.getByTestId('worker-type-MISTRI'));
    expect(rate()).toBe('2800');
    await fireEvent.press(screen.getByTestId('worker-type-MAZDOOR'));
    expect(rate()).toBe('1800.5');
    await fireEvent.press(screen.getByTestId('worker-type-OTHER'));
    expect(rate()).toBe('');
    await fireEvent.changeText(screen.getByTestId('worker-rate'), '2000');
    await fireEvent.press(screen.getByTestId('worker-type-MISTRI'));
    expect(rate()).toBe('2000');
    await fireEvent.changeText(screen.getByTestId('worker-name'), 'Bashir');
    await fireEvent.press(screen.getByTestId('save-worker'));
    expect(JSON.parse(pendingItems(mockDb)[0]!.payload)).toEqual({ name: 'Bashir', type: 'MISTRI', dailyRatePaisa: '200000' });
  });

  it('a munshi sets no rate — the company rate is used', async () => {
    mockRole = 'MUNSHI';
    seed();
    await show('roman');
    expect(screen.queryByTestId('worker-rate')).toBeNull();
    await fireEvent.press(screen.getByTestId('worker-type-MISTRI'));
    await fireEvent.changeText(screen.getByTestId('worker-name'), 'Bashir');
    await fireEvent.press(screen.getByTestId('save-worker'));
    expect(JSON.parse(pendingItems(mockDb)[0]!.payload)).toEqual({ name: 'Bashir', type: 'MISTRI' });
  });

  it('follows fields.rates from the server: a PM without it sets no rate', async () => {
    mockRole = 'PM';
    seed();
    saveAccess(mockDb, { permissions: ['masterdata.worker.create'], fieldAccess: { rates: false, amounts: false, profit: false, contract: false } });
    await show('roman');
    expect(screen.queryByTestId('worker-rate')).toBeNull();
  });

  it('a munshi given fields.rates by an override may set the rate', async () => {
    mockRole = 'MUNSHI';
    seed();
    saveAccess(mockDb, { permissions: ['masterdata.worker.create', 'fields.rates'], fieldAccess: { rates: true, amounts: false, profit: false, contract: false } });
    await show('roman');
    expect(screen.getByTestId('worker-rate')).toBeTruthy();
  });
});
