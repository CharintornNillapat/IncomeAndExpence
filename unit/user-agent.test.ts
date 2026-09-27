import { describe, it, expect } from 'vitest';
import { describeUserAgent } from '../src/utils/userAgent';

/**
 * The account's session list labels every session from the user agent
 * `auth.sessions` recorded (ADR 0024). The order-sensitive cases are the ones
 * worth pinning: Edge says "Chrome", Chrome says "Safari", an iPhone says
 * "Mac OS X".
 */
const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  edgeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};

describe('describeUserAgent', () => {
  it.each([
    [UA.chromeWindows, 'Chrome on Windows', false],
    [UA.edgeWindows, 'Edge on Windows', false],
    [UA.safariIphone, 'Safari on iPhone', true],
    [UA.chromeIphone, 'Chrome on iPhone', true],
    [UA.safariMac, 'Safari on macOS', false],
    [UA.firefoxLinux, 'Firefox on Linux', false],
    [UA.chromeAndroid, 'Chrome on Android', true],
  ])('labels %s', (ua, label, isMobile) => {
    expect(describeUserAgent(ua)).toEqual({ label, isMobile });
  });

  it('says so when there is nothing to go on', () => {
    expect(describeUserAgent(null).label).toBe('Unknown device');
    expect(describeUserAgent('   ').label).toBe('Unknown device');
    expect(describeUserAgent('curl/8.4.0').label).toBe('Unknown device');
  });
});
