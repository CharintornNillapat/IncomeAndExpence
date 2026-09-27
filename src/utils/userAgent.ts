/**
 * A human label for a session's user agent (ADR 0024), e.g. "Chrome on
 * Windows". Moved out of the retired `detectCurrentDevice`, which labelled only
 * the current browser; the account's session list now labels every session
 * `auth.sessions` records, from whatever user agent that row carries.
 *
 * Order matters in both lists: Edge's user agent also says "Chrome", Chrome's
 * also says "Safari", and an iPad or iPhone's also says "Mac OS X".
 */
export interface DeviceLabel {
  label: string;
  isMobile: boolean;
}

const OS_RULES: [RegExp, string][] = [
  [/iPhone/i, 'iPhone'],
  [/iPad/i, 'iPad'],
  [/Android/i, 'Android'],
  [/Windows/i, 'Windows'],
  [/Macintosh|Mac OS X/i, 'macOS'],
  [/CrOS/i, 'ChromeOS'],
  [/Linux/i, 'Linux'],
];

const BROWSER_RULES: [RegExp, string][] = [
  [/Edg\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/Firefox\/|FxiOS/i, 'Firefox'],
  [/Chrome\/|CriOS/i, 'Chrome'],
  [/Safari\//i, 'Safari'],
];

export function describeUserAgent(userAgent: string | null | undefined): DeviceLabel {
  const ua = userAgent ?? '';
  if (!ua.trim()) return { label: 'Unknown device', isMobile: false };

  const os = OS_RULES.find(([re]) => re.test(ua))?.[1];
  const browser = BROWSER_RULES.find(([re]) => re.test(ua))?.[1];
  const isMobile = /iPhone|iPad|Android|Mobile/i.test(ua);

  if (browser && os) return { label: `${browser} on ${os}`, isMobile };
  if (os) return { label: os, isMobile };
  if (browser) return { label: browser, isMobile };
  return { label: 'Unknown device', isMobile };
}
