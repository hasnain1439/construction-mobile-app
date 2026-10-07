import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { BigButton } from '../components/BigButton';
import { MoneyText } from '../components/MoneyText';
import { StepperInput } from '../components/StepperInput';
import { SyncBanner } from '../components/SyncBanner';
import { eq } from 'drizzle-orm';
import { outbox } from '../src/db/schema';
import { I18nProvider, translate } from '../src/i18n';
import { roman } from '../src/i18n/roman';
import { refreshStatus, resetEngineForTests } from '../src/sync/engine';
import { enqueue } from '../src/sync/outbox';
import { testDb } from './helpers/db';

const mockPush = jest.fn();
const mockSync = jest.fn(async () => undefined);
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() } }));
jest.mock('../src/sync/triggers', () => ({ syncFromApp: () => mockSync(), useRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));

beforeEach(() => {
  resetEngineForTests();
  mockPush.mockClear();
  mockSync.mockClear();
});

describe('shared components', () => {
  it('StepperInput steps in halves within its limits', async () => {
    function Host() {
      const [v, setV] = useState(0);
      return <StepperInput label="OT" value={v} step={0.5} max={1} onChange={setV} />;
    }
    await render(<Host />);
    await fireEvent.press(screen.getByLabelText('OT +'));
    await fireEvent.press(screen.getByLabelText('OT +'));
    await fireEvent.press(screen.getByLabelText('OT +'));
    expect(screen.getByText('1')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('OT −'));
    expect(screen.getByText('0.5')).toBeTruthy();
  });

  it('BigButton does nothing while loading or disabled', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<BigButton label="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await rerender(<BigButton label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('MoneyText formats paisa', async () => {
    await render(<MoneyText paisa="277500000" />);
    expect(screen.getByText('Rs 27,75,000')).toBeTruthy();
  });

  it('SyncBanner says all synced, and runs a sync when tapped', async () => {
    await render(
      <I18nProvider initial="roman">
        <SyncBanner />
      </I18nProvider>,
    );
    expect(screen.getByText(roman['sync.allSynced'])).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sync-banner'));
    expect(mockSync).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('SyncBanner shows waiting entries, then problems, which open the problems screen', async () => {
    const db = testDb();
    await render(
      <I18nProvider initial="roman">
        <SyncBanner />
      </I18nProvider>,
    );
    const id = enqueue(db, { type: 'CASH_EXPENSE_CREATE', payload: {}, label: 'Chai' });
    await act(async () => refreshStatus(db));
    expect(screen.getByText(new RegExp(translate('roman', 'sync.waiting', { n: 1 })))).toBeTruthy();
    db.update(outbox).set({ status: 'REJECTED', lastError: '{"code":"WEEK_LOCKED"}' }).where(eq(outbox.clientId, id)).run();
    await act(async () => refreshStatus(db));
    expect(screen.getByText(new RegExp(translate('roman', 'sync.problems', { n: 1 })))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sync-banner'));
    expect(mockPush).toHaveBeenCalledWith('/sync-problems');
  });
});
