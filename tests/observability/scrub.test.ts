import { FILTERED, scrubBreadcrumb, scrubEvent, scrubString } from '../../src/lib/observability/scrub';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJ0aWQiOiJ0LTEifQ.c2lnbmF0dXJlLXZhbHVlLWhlcmU';

describe('scrubString', () => {
  it.each([
    ['email', 'failed for ali.khan@example.pk today', 'ali.khan@example.pk'],
    ['+92 phone', 'otp sent to +923001234567', '+923001234567'],
    ['+92 spaced', 'call +92 300 1234567', '300 1234567'],
    ['92 phone', 'user 923001234567 blocked', '923001234567'],
    ['03xx phone', 'munshi 0300-1234567 offline', '0300-1234567'],
    ['E.164 other', 'number +14155552671 invalid', '+14155552671'],
    ['CNIC', 'cnic 35202-1234567-1 mismatch', '35202-1234567-1'],
    ['JWT', `token ${JWT} expired`, JWT],
    ['bearer', 'Authorization: Bearer abc.def-ghi', 'abc.def-ghi'],
    ['long token', 'refresh a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8 rejected', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'],
    ['cookie', 'cookie: access_token=xyz; refresh=abc', 'access_token=xyz'],
    ['money', 'balance Rs 12,500 short', '12,500'],
  ])('redacts %s', (_, input, secret) => {
    const out = scrubString(input);
    expect(out).not.toContain(secret);
    expect(out).toContain(FILTERED);
  });

  it('redacts secret query params but keeps the path', () => {
    const out = scrubString('https://api.example.pk/api/v1/files/abc?token=s3cr3t&code=123456&sig=zz&w=200');
    expect(out).toBe(`https://api.example.pk/api/v1/files/abc?token=${FILTERED}&code=${FILTERED}&sig=${FILTERED}&w=200`);
  });

  it('keeps ordinary text, UUIDs and error codes', () => {
    const s = 'PERMISSION_DENIED for 0193e4b2-7c1a-7d3e-9f00-1234567890ab at /api/v1/sync/push';
    expect(scrubString(s)).toBe(s);
  });
});

describe('scrubEvent', () => {
  it('drops request bodies, cookies and auth headers; keeps only the user id', () => {
    const out = scrubEvent({
      message: 'login failed for 03001234567',
      exception: { values: [{ type: 'Error', value: `bad ${JWT}` }] },
      request: {
        url: 'https://api.example.pk/api/v1/auth/otp/verify?code=1234',
        data: { phone: '+923001234567', code: '1234' },
        cookies: { access_token: 'x' },
        headers: { Authorization: `Bearer ${JWT}`, Cookie: 'a=b', 'content-type': 'application/json' },
      },
      user: { id: 'hash123', email: 'a@b.pk', username: 'Ali', ip_address: '1.2.3.4' },
      extra: { amountPaisa: 120000, note: 'paid Rs 500 to ali@x.pk', nested: { phone: '0300 1234567', count: 2 } },
      tags: { tenantId: 'cmabc123def456ghi789jkl', who: 'ali@x.pk' },
    });
    expect(out.message).not.toContain('03001234567');
    expect(out.exception?.values?.[0]?.value).not.toContain('eyJ');
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toEqual({ 'content-type': 'application/json' });
    expect(out.request?.url).toContain(`code=${FILTERED}`);
    expect(out.user).toEqual({ id: 'hash123' });
    expect(out.extra).toEqual({ amountPaisa: FILTERED, note: `paid ${FILTERED} to ${FILTERED}`, nested: { phone: FILTERED, count: 2 } });
    expect(out.tags).toEqual({ tenantId: 'cmabc123def456ghi789jkl', who: FILTERED });
    expect(JSON.stringify(out)).not.toMatch(/ali@|1234567|120000|eyJ/);
  });

  it('scrubs breadcrumbs: bodies dropped, urls and messages cleaned, touch labels removed', () => {
    const http = scrubBreadcrumb({ category: 'fetch', data: { url: 'https://x.pk/a?token=abc', method: 'POST', status_code: 200, body: '{"amountPaisa":5}', request_body: 'x' } });
    expect(http?.data).toEqual({ url: `https://x.pk/a?token=${FILTERED}`, method: 'POST', status_code: 200 });
    const consoleCrumb = scrubBreadcrumb({ category: 'console', message: 'user ali@x.pk', data: { arguments: ['ali@x.pk'], logger: 'console' } });
    expect(consoleCrumb?.message).toBe(`user ${FILTERED}`);
    expect(consoleCrumb?.data).toEqual({ logger: 'console' });
    const touch = scrubBreadcrumb({ category: 'touch', message: 'Touch event within element: Ahmed Mistri', data: { path: [{ label: 'Ahmed' }] } });
    expect(touch?.message).toBeUndefined();
    expect(touch?.data).toBeUndefined();
  });
});
