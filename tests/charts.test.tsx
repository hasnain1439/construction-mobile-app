/**
 * Home / Office charts: a column chart that reads one value at a time (tap a column), and the company
 * charts — shown only to people who see money.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ColumnChart } from '../components/Charts';
import { CompanyCharts } from '../components/CompanyCharts';
import type { Overview } from '../src/features/office';
import { I18nProvider } from '../src/i18n';

const wrap = (el: React.ReactElement) => render(<I18nProvider initial="en">{el}</I18nProvider>);

describe('charts', () => {
  it('column chart: shows the latest value, tapping a column reads that one', async () => {
    await wrap(
      <ColumnChart
        data={[
          { key: 'mon', label: 'M', value: 8, display: '8 present' },
          { key: 'tue', label: 'T', value: 12, display: '12 present' },
        ]}
      />,
    );
    expect(screen.getByText('12 present')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('col-mon'));
    expect(screen.getByText('8 present')).toBeTruthy();
  });

  const overview = (over: Partial<Overview['kpis']>, seesFinancials = true): Overview => ({
    seesFinancials,
    kpis: { activeProjects: { count: 2, atRisk: 0, delayed: 0 }, pendingApprovals: 0, openShortages: 0, dispatchesOnTheWay: 0, ...over },
    projects: [
      { project: { id: 'a', code: 'P-1', name: 'DHA', status: 'ACTIVE' }, client: null, outstandingPaisa: '1165670000' },
      { project: { id: 'b', code: 'P-2', name: 'Bahria', status: 'ACTIVE' }, client: null, outstandingPaisa: '840000000' },
      { project: { id: 'c', code: 'P-3', name: 'Paid', status: 'ACTIVE' }, client: null, outstandingPaisa: '0' },
    ],
  });

  it('company charts: collected meter and projects owing the most (largest first, none at zero)', async () => {
    await wrap(<CompanyCharts overview={overview({ receivablesOutstandingPaisa: '2005670000', collectedPercent: 92.1, invoicedPaisa: '46915670000', receivedPaisa: '43230000000' })} />);
    expect(screen.getByTestId('chart-collected')).toBeTruthy();
    expect(screen.getByText('92%')).toBeTruthy();
    const owing = screen.getByTestId('chart-owing');
    expect(owing).toBeTruthy();
    expect(screen.queryByText(/P-3/)).toBeNull();
    expect(screen.getByText('P-1 · DHA')).toBeTruthy();
  });

  it('company charts: nothing without money access', async () => {
    await wrap(<CompanyCharts overview={overview({}, false)} />);
    expect(screen.queryByTestId('chart-collected')).toBeNull();
    expect(screen.queryByTestId('chart-owing')).toBeNull();
  });
});
