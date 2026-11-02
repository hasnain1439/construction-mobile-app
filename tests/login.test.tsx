/**
 * Sign-in like the web dashboard: email or mobile number + password first; SMS code for site staff.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { I18nProvider } from '../src/i18n';
import { loginIdentifier } from '../src/lib/loginId';

const mockPasswordLogin = jest.fn();
const mockRequestOtp = jest.fn();
const mockSignedIn = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('../src/api/auth', () => ({
  passwordLogin: (...a: unknown[]) => mockPasswordLogin(...a),
  requestOtp: (...a: unknown[]) => mockRequestOtp(...a),
}));
jest.mock('../src/features/session', () => ({ useSession: () => ({ signedIn: mockSignedIn }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LoginScreen = require('../app/(auth)/login').default as React.ComponentType;
const wrap = () => render(<I18nProvider initial="en"><LoginScreen /></I18nProvider>);

describe('login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reads an email or a Pakistani mobile number', () => {
    expect(loginIdentifier(' Owner@Malik.PK ')).toBe('owner@malik.pk');
    expect(loginIdentifier('0321 1234567')).toBe('+923211234567');
    expect(loginIdentifier('owner@')).toBeNull();
    expect(loginIdentifier('12')).toBeNull();
  });

  it('opens on email + password (like the web) and signs in with the email', async () => {
    mockPasswordLogin.mockResolvedValue({ id: 'u1' });
    await wrap();
    expect(screen.getByText('Email or mobile number')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('login-input'), 'Owner@Malik.pk');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(mockPasswordLogin).toHaveBeenCalledWith('owner@malik.pk', 'secret');
    expect(mockSignedIn).toHaveBeenCalled();
  });

  it('a wrong email is caught before asking the server', async () => {
    await wrap();
    await fireEvent.changeText(screen.getByTestId('login-input'), 'owner@');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'secret');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(screen.getByText('Enter your email or a Pakistani mobile number')).toBeTruthy();
    expect(mockPasswordLogin).not.toHaveBeenCalled();
  });

  it('SMS code tab: mobile number only', async () => {
    mockRequestOtp.mockResolvedValue({ sent: true, expiresIn: 300, resendAfter: 60 });
    await wrap();
    await fireEvent.press(screen.getByTestId('mode-code'));
    expect(screen.queryByTestId('password-input')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('login-input'), '0321 1234567');
    await fireEvent.press(screen.getByTestId('send-code'));
    expect(mockRequestOtp).toHaveBeenCalledWith('+923211234567');
    expect(mockPush).toHaveBeenCalled();
  });
});
