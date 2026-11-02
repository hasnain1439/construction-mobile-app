/**
 * Office expenses (company running costs, not tied to a site): the month list with its total and
 * by-type chart, the add button only with the manage key, and the form sending paisa to the API
 * (POST to add, PATCH / DELETE when opened from the list).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ExpenseForm from '../app/office/expense-new';
import OfficeExpenses from '../app/office/expenses';
import { I18nProvider } from '../src/i18n';
import { monthRange, officeSections, shiftMonth } from '../src/features/office';
import { addDays, todayPK } from '../src/lib/dates';
import { routeAllowed, type Access, type Role } from '../src/lib/permissions';

jest.setTimeout(30000);

let mockRole: Role = 'THEKEDAR';
let mockAccess: Access | null = null;
let mockParams: Record<string, string> = {};
const mockRequest = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack() }, useLocalSearchParams: () => mockParams, useFocusEffect: () => undefined }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: jest.fn(async () => undefined), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('../src/features/session', () => ({ useUser: () => ({ id: 'u1', name: 'Khalid Malik', role: mockRole }) }));
jest.mock('../src/features/access', () => {
  const perms = jest.requireActual('../src/lib/permissions');
  return {
    usePermissions: () => ({
      access: mockAccess,
      role: mockRole,
      can: (k: string) => perms.can(mockAccess, mockRole, k),
      canAny: (...k: string[]) => perms.canAny(mockAccess, mockRole, k),
      sees: (f: string) => perms.seesField(mockAccess, mockRole, f),
    }),
  };
});
jest.mock('../src/api/client', () => {
  const actual = jest.requireActual('../src/api/client');
  return { ...actual, request: (...args: unknown[]) => mockRequest(...args) };
});
jest.mock('../components/SyncBanner', () => ({ SyncBanner: () => null }));

const block = (permissions: string[]): Access => ({ permissions, fieldAccess: { rates: false, amounts: true, profit: false, contract: false, wages: true }, scopes: {}, approvalLimits: {}, permissionRole: null });
const VIEWER = block(['finance.officeexpense.view']);

const LIST = {
  data: [
    { id: 'e1', date: '2026-11-01', category: { id: 'c-rent', name: 'Rent' }, amountPaisa: '8500000', paidVia: 'BANK', paidTo: 'Ch. Aslam', description: 'Office rent, November', attachmentId: null, createdBy: { id: 'u1', name: 'Khalid Malik' }, createdAt: '2026-11-01T06:00:00Z', updatedBy: null, updatedAt: '2026-11-01T06:00:00Z' },
    { id: 'e2', date: '2026-11-02', category: { id: 'c-tea', name: 'Tea' }, amountPaisa: '550000', paidVia: 'CASH', paidTo: null, description: 'Tea for the office', attachmentId: null, createdBy: null, createdAt: '2026-11-02T06:00:00Z', updatedBy: null, updatedAt: '2026-11-02T06:00:00Z' },
  ],
  meta: { page: 1, limit: 100, total: 2, totalPages: 1, totalPaisa: '9050000', byCategory: [{ categoryId: 'c-rent', name: 'Rent', totalPaisa: '8500000' }, { categoryId: 'c-tea', name: 'Tea', totalPaisa: '550000' }] },
};

const wrap = (ui: React.ReactElement) =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <I18nProvider initial="en">{ui}</I18nProvider>
    </SafeAreaProvider>,
  );
const press = (id: string) =>
  act(async () => {
    await fireEvent.press(screen.getByTestId(id));
  });
const type = (id: string, text: string) =>
  act(async () => {
    await fireEvent.changeText(screen.getByTestId(id), text);
  });

beforeEach(() => {
  mockRequest.mockReset();
  mockPush.mockReset();
  mockBack.mockReset();
  mockParams = {};
  mockRole = 'THEKEDAR';
  mockAccess = null;
});

describe('office expenses access', () => {
  it('the section and its pages follow the view / manage keys', () => {
    expect(officeSections(null, 'THEKEDAR')).toContain('expenses');
    expect(officeSections(VIEWER, 'PM')).toEqual(['expenses']);
    expect(officeSections(block(['dashboard.overview.view']), 'PM')).not.toContain('expenses');
    expect(routeAllowed(VIEWER, 'PM', '/office/expenses')).toBe(true);
    expect(routeAllowed(VIEWER, 'PM', '/office/expense-new')).toBe(false);
    expect(routeAllowed(null, 'THEKEDAR', '/office/expense-new')).toBe(true);
  });

  it('months: first and last day, and stepping across a year', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});

describe('Office expenses list', () => {
  it('owner: this month, its total, a bar per type, every entry and the add button', async () => {
    mockRequest.mockResolvedValue(LIST);
    await wrap(<OfficeExpenses />);
    expect(await screen.findByTestId('oexp-e1')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/office-expenses', { query: { ...monthRange(todayPK().slice(0, 7)), limit: 100 }, envelope: true });
    expect(within(screen.getByTestId('oexp-total')).getByText('Rs 90,500')).toBeTruthy();
    expect(within(screen.getByTestId('oexp-by-category')).getByText('Rent')).toBeTruthy();
    expect(screen.getByText('Office rent, November')).toBeTruthy();
    expect(screen.getByText('Tea for the office')).toBeTruthy();
    expect(screen.getByText('Ch. Aslam')).toBeTruthy();
    expect(screen.getByTestId('oexp-add')).toBeTruthy();

    await press('oexp-add');
    expect(mockPush).toHaveBeenCalledWith('/office/expense-new');
    await press('oexp-e1');
    expect(mockPush).toHaveBeenLastCalledWith(expect.objectContaining({ pathname: '/office/expense-new', params: expect.objectContaining({ id: 'e1', amountPaisa: '8500000', categoryId: 'c-rent' }) }));
  });

  it('the previous month asks for that month', async () => {
    mockRequest.mockResolvedValue(LIST);
    await wrap(<OfficeExpenses />);
    await screen.findByTestId('oexp-e1');
    await press('oexp-prev');
    const prev = shiftMonth(todayPK().slice(0, 7), -1);
    await waitFor(() => expect(mockRequest).toHaveBeenLastCalledWith('/office-expenses', { query: { ...monthRange(prev), limit: 100 }, envelope: true }));
  });

  it('view only: no add button and entries cannot be opened', async () => {
    mockRole = 'PM';
    mockAccess = VIEWER;
    mockRequest.mockResolvedValue(LIST);
    await wrap(<OfficeExpenses />);
    expect(await screen.findByTestId('oexp-e1')).toBeTruthy();
    expect(screen.queryByTestId('oexp-add')).toBeNull();
    await press('oexp-e1');
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('Office expense form', () => {
  const CATS = [
    { id: 'c-bills', name: 'Bills', expenseCount: 4 },
    { id: 'c-rent', name: 'Rent', expenseCount: 12 },
  ];
  /** The categories GET answers with the company's list; every other call with `other`. */
  const answer = (other: () => Promise<unknown>) => mockRequest.mockImplementation((path: string) => (path === '/office-expenses/categories' ? Promise.resolve(CATS) : other()));
  const sent = () => mockRequest.mock.calls.filter(([path]) => path !== '/office-expenses/categories');

  it('adds one: types come from the company list, rupees become paisa, no "paid to" when left empty', async () => {
    answer(async () => ({ id: 'new' }));
    await wrap(<ExpenseForm />);
    expect(await screen.findByTestId('oexp-cat-c-rent')).toBeTruthy();
    expect(screen.getByText('Bills')).toBeTruthy();
    await type('oexp-amount', '1,500.5');
    await press('oexp-cat-c-bills');
    await press('oexp-via-BANK');
    await type('oexp-description', '  Electricity bill ');
    await press('oexp-save');
    expect(mockRequest).toHaveBeenCalledWith('/office-expenses', {
      method: 'POST',
      body: { date: todayPK(), categoryId: 'c-bills', amountPaisa: '150050', paidVia: 'BANK', description: 'Electricity bill' },
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('yesterday and a payee are sent too', async () => {
    answer(async () => ({ id: 'new' }));
    await wrap(<ExpenseForm />);
    await press('oexp-cat-c-rent');
    await type('oexp-amount', '85000');
    await press(`oexp-date-${addDays(todayPK(), -1)}`);
    await type('oexp-paid-to', 'Ch. Aslam');
    await type('oexp-description', 'Office rent');
    await press('oexp-save');
    expect(mockRequest).toHaveBeenCalledWith('/office-expenses', {
      method: 'POST',
      body: { date: addDays(todayPK(), -1), categoryId: 'c-rent', amountPaisa: '8500000', paidVia: 'CASH', paidTo: 'Ch. Aslam', description: 'Office rent' },
    });
  });

  it('nothing is sent without an amount, a type and a description', async () => {
    answer(async () => ({}));
    await wrap(<ExpenseForm />);
    await screen.findByTestId('oexp-cat-c-rent');
    await press('oexp-save');
    expect(sent()).toEqual([]);
    expect(screen.getByText('Required')).toBeTruthy();
    expect(screen.getByText('Choose the type of expense')).toBeTruthy();
    expect(screen.getByText('Write what the money was paid for')).toBeTruthy();
  });

  it('no types yet: says the office adds them on the website', async () => {
    mockRequest.mockResolvedValue([]);
    await wrap(<ExpenseForm />);
    expect(await screen.findByText('No expense types yet — the office adds them on the website')).toBeTruthy();
  });

  it('shows the server reason (a future date)', async () => {
    const { ApiError } = jest.requireActual('../src/api/client');
    answer(() => Promise.reject(new ApiError(400, 'FUTURE_DATE', 'x')));
    await wrap(<ExpenseForm />);
    await press('oexp-cat-c-rent');
    await type('oexp-amount', '100');
    await type('oexp-description', 'Pens');
    await press('oexp-save');
    expect(screen.getByTestId('oexp-error').props.children).toBe('The date is in the future');
    expect(mockBack).not.toHaveBeenCalled();
  });

  const OPENED = { id: 'e1', date: '2026-10-20', categoryId: 'c-rent', amountPaisa: '8500000', paidVia: 'BANK', paidTo: 'Ch. Aslam', description: 'Office rent' };

  it('opened from the list: its type is chosen, changes go with PATCH (cleared payee → null)', async () => {
    mockParams = OPENED;
    answer(async () => ({}));
    await wrap(<ExpenseForm />);
    expect((await screen.findByTestId('oexp-cat-c-rent')).props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(screen.getByTestId('oexp-amount').props.value).toBe('85000');
    await type('oexp-amount', '90000');
    await type('oexp-paid-to', '');
    await press('oexp-save');
    expect(mockRequest).toHaveBeenCalledWith('/office-expenses/e1', {
      method: 'PATCH',
      body: { date: '2026-10-20', categoryId: 'c-rent', amountPaisa: '9000000', paidVia: 'BANK', paidTo: null, description: 'Office rent' },
    });
    expect(mockBack).toHaveBeenCalled();
  });

  it('opened from the list: deletes only after confirming', async () => {
    mockParams = OPENED;
    answer(async () => ({ deleted: true }));
    await wrap(<ExpenseForm />);
    await screen.findByTestId('oexp-cat-c-rent');
    const cancel = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await press('oexp-delete');
    expect(cancel).toHaveBeenCalled();
    expect(sent()).toEqual([]);
    cancel.mockRestore();

    const confirm = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());
    await press('oexp-delete');
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(mockRequest).toHaveBeenCalledWith('/office-expenses/e1', { method: 'DELETE' });
    confirm.mockRestore();
  });

  it('a new expense has no delete button', async () => {
    answer(async () => ({}));
    await wrap(<ExpenseForm />);
    await screen.findByTestId('oexp-cat-c-rent');
    expect(screen.queryByTestId('oexp-delete')).toBeNull();
  });
});
