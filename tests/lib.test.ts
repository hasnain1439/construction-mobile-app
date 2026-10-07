import { versionLess } from '../src/api/auth';
import { errorText, translate } from '../src/i18n';
import { en } from '../src/i18n/en';
import { roman } from '../src/i18n/roman';
import { addDays, todayPK, weekOf } from '../src/lib/dates';
import { formatPKR, rupeesToPaisa, sumPaisa } from '../src/lib/money';
import { displayPhone, normalisePhone } from '../src/lib/phone';
import { uuidv7 } from '../src/lib/uuid';
import { cleanNumber } from '../components/QuantityInput';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('expo-file-system', () => ({ Directory: class {}, File: class {}, Paths: {} }));

describe('helpers', () => {
  it('money in South Asian grouping, typed rupees → paisa', () => {
    expect(formatPKR('277500000')).toBe('Rs 27,75,000');
    expect(formatPKR('-150050')).toBe('−Rs 1,500.50');
    expect(rupeesToPaisa('1,500')).toBe('150000');
    expect(rupeesToPaisa('12.5')).toBe('1250');
    expect(rupeesToPaisa('0')).toBeNull();
    expect(rupeesToPaisa('abc')).toBeNull();
    expect(sumPaisa(['100', null, '-50'])).toBe('50');
  });

  it('phones', () => {
    expect(normalisePhone('0321 1234567')).toBe('+923211234567');
    expect(normalisePhone('+92-321-1234567')).toBe('+923211234567');
    expect(normalisePhone('042 1234567')).toBeNull();
    expect(displayPhone('+923211234567')).toBe('0321 1234567');
  });

  it('dates in Pakistan time and settlement weeks', () => {
    expect(todayPK(new Date('2026-10-05T20:30:00Z'))).toBe('2026-10-06');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(weekOf('2026-10-08', 'MONDAY')).toMatchObject({ weekStart: '2026-10-05', weekEnd: '2026-10-11' });
    expect(weekOf('2026-10-08', 'SATURDAY').weekStart).toBe('2026-10-03');
  });

  it('uuid v7 is time-ordered', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });

  it('app version compare (forced update)', () => {
    expect(versionLess('1.0.0', '1.0.1')).toBe(true);
    expect(versionLess('1.2.10', '1.10.0')).toBe(true);
    expect(versionLess('1.10.0', '1.2.10')).toBe(false);
    expect(versionLess('1.0.0', '1.0.0')).toBe(false);
  });

  it('number input keeps digits and one decimal point', () => {
    expect(cleanNumber('1,2a3.4.56')).toBe('123.456');
    expect(cleanNumber('12.345', 2)).toBe('12.34');
  });

  it('photos are resized to 1280 px on the long side, never upscaled', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resizeFor } = require('../src/features/media') as typeof import('../src/features/media');
    expect(resizeFor(4000, 3000)).toEqual({ width: 1280 });
    expect(resizeFor(3000, 4000)).toEqual({ height: 1280 });
    expect(resizeFor(800, 600)).toBeNull();
  });
});

describe('i18n', () => {
  it('Roman Urdu has every key; Urdu falls back to Roman Urdu; vars are filled', () => {
    expect(Object.keys(roman).sort()).toEqual(Object.keys(en).sort());
    expect(translate('roman', 'sync.waiting', { n: 12 })).toContain('12');
    expect(translate('ur', 'app.name')).toBe('منشی');
  });

  it('server error codes map to the munshi’s language; unknown codes get a generic message', () => {
    expect(errorText('en', 'WEEK_LOCKED')).toBe(en['err.WEEK_LOCKED']);
    expect(errorText('roman', 'SOMETHING_NEW')).toBe(roman['err.generic']);
  });
});
