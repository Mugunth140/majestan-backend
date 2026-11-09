import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export const ANALYTICS_HOSTS = new Set([
  'majestanrealty.com',
  'www.majestanrealty.com',
]);
export const EVENT_NAMES = {
  pageview: ['pageview'],
  engagement: ['heartbeat', 'leave'],
  web_vital: ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB'],
  interaction: [
    'phone_click',
    'email_click',
    'whatsapp_click',
    'outbound_click',
    'download_click',
    'search',
    'wishlist_add',
    'wishlist_remove',
  ],
  conversion: [
    'enquiry_submitted',
    'site_visit_requested',
    'owner_submission',
    'registration_completed',
  ],
  error: ['javascript_error', 'unhandled_rejection', 'api_error'],
} as const;
export type AnalyticsKind = keyof typeof EVENT_NAMES;
export type AnalyticsEvent = {
  id: string;
  sessionId: string;
  pageId: string;
  kind: AnalyticsKind;
  name: string;
  timestamp: number;
  path: string;
  hostname: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  language?: string;
  timezone?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  screenWidth?: number;
  screenHeight?: number;
  durationMs?: number;
  scrollPercent?: number;
  value?: number;
  rating?: string;
  metricId?: string;
  targetHost?: string;
  entityId?: number;
  entityKind?: 'property' | 'project';
  statusCode?: number;
};
const UUID =
  /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const KEYS = new Set([
  'id',
  'sessionId',
  'pageId',
  'kind',
  'name',
  'timestamp',
  'path',
  'hostname',
  'referrer',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'language',
  'timezone',
  'viewportWidth',
  'viewportHeight',
  'screenWidth',
  'screenHeight',
  'durationMs',
  'scrollPercent',
  'value',
  'rating',
  'metricId',
  'targetHost',
  'entityId',
  'entityKind',
  'statusCode',
]);
const PRIVATE_PATH =
  /^\/(admin|api|site-api|login|register|reset-password|detail-render|detail-section|seo-route|seo-section)(\/|$)/i;

/** Public paths only: no query strings, fragments, credentials, encoded PII or arbitrary URLs. */
export function analyticsPath(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 512 ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return null;
  try {
    const path =
      decodeURIComponent(value.split(/[?#]/)[0]).replace(/\/+$/, '') || '/';
    if (
      PRIVATE_PATH.test(path) ||
      /[@\\\s?#%]/.test(path) ||
      /\d{10,}/.test(path) ||
      /(?:^|\/)\.{1,2}(?:\/|$)/.test(path) ||
      !/^\/[a-zA-Z0-9/_.,~+-]*$/.test(path)
    )
      return null;
    return path;
  } catch {
    return null;
  }
}

export function analyticsToken(value: unknown, max = 80): string | null {
  return typeof value === 'string' &&
    value.length <= max &&
    /^[\w .+:/-]+$/.test(value) &&
    !/\d{10,}/.test(value)
    ? value
    : null;
}

// web-vitals IDs contain an epoch timestamp and random numeric suffix; unlike
// campaign labels, long digit sequences are expected in this opaque identifier.
function metricId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value)
    ? value
    : undefined;
}

export function analyticsHost(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 253) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return /^[a-z\d.-]+$/i.test(url.hostname)
      ? url.hostname.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function validateBatch(
  body: unknown,
  now = Date.now(),
): AnalyticsEvent[] {
  const invalid = () => {
    throw new BadRequestException('Invalid analytics batch');
  };
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !['version', 'events'].includes(k))
  )
    return invalid();
  const { version, events } = body as { version: unknown; events: unknown };
  if (
    version !== 1 ||
    !Array.isArray(events) ||
    events.length < 1 ||
    events.length > 20
  )
    return invalid();
  return events.map((input: unknown) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return invalid();
    const e = input as AnalyticsEvent;
    if (
      Object.keys(e).some((k) => !KEYS.has(k)) ||
      !UUID.test(e.id) ||
      !UUID.test(e.sessionId) ||
      !UUID.test(e.pageId) ||
      !Object.hasOwn(EVENT_NAMES, e.kind) ||
      !(EVENT_NAMES[e.kind] as readonly string[]).includes(e.name) ||
      !Number.isSafeInteger(e.timestamp) ||
      e.timestamp < now - 24 * 3600_000 ||
      e.timestamp > now + 300_000 ||
      !analyticsPath(e.path) ||
      !ANALYTICS_HOSTS.has(e.hostname)
    )
      return invalid();
    if (
      e.entityKind !== undefined &&
      (!['property', 'project'].includes(e.entityKind) ||
        !Number.isSafeInteger(e.entityId) ||
        !e.entityId)
    )
      return invalid();
    const limits: Record<string, number> = {
      viewportWidth: 20000,
      viewportHeight: 20000,
      screenWidth: 20000,
      screenHeight: 20000,
      durationMs: 1800_000,
      scrollPercent: 100,
      value: e.name === 'CLS' ? 100 : 3600_000,
      entityId: 2147483647,
      statusCode: 599,
    };
    for (const [key, max] of Object.entries(limits)) {
      const n: unknown = e[key as keyof AnalyticsEvent];
      if (
        n !== undefined &&
        (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max)
      )
        return invalid();
    }
    if (
      e.kind === 'web_vital' &&
      (e.value === undefined ||
        !metricId(e.metricId) ||
        !['good', 'needs-improvement', 'poor'].includes(e.rating ?? ''))
    )
      return invalid();
    if (
      e.rating !== undefined &&
      !['good', 'needs-improvement', 'poor'].includes(e.rating)
    )
      return invalid();
    return {
      ...e,
      path: analyticsPath(e.path)!,
      referrer: analyticsHost(e.referrer) ?? undefined,
      targetHost: analyticsHost(e.targetHost) ?? undefined,
      utmSource: analyticsToken(e.utmSource) ?? undefined,
      utmMedium: analyticsToken(e.utmMedium) ?? undefined,
      utmCampaign: analyticsToken(e.utmCampaign) ?? undefined,
      language: analyticsToken(e.language, 35) ?? undefined,
      timezone: analyticsToken(e.timezone, 80) ?? undefined,
      metricId: e.kind === 'web_vital' ? metricId(e.metricId) : undefined,
    };
  });
}

/** Rotating pseudonym; neither the raw address nor raw user agent is persisted. */
export function visitorId(
  secret: string,
  ip: string,
  ua: string,
  now = new Date(),
) {
  return createHmac('sha256', secret)
    .update(`${now.toISOString().slice(0, 10)}\n${ip}\n${ua.slice(0, 512)}`)
    .digest('hex');
}

export function deviceInfo(ua: string) {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /(?:Chrome|CriOS)\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Other';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other';
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua)
    ? 'tablet'
    : /Mobile|iPhone|iPod/i.test(ua)
      ? 'mobile'
      : 'desktop';
  return { browser, os, device };
}

export function pageRoute(path: string): string {
  if (/^\/[^/]+-[a-z]{1,6}\d+(\/|$)/i.test(path))
    return '/:inventory' + (path.includes('/', 1) ? '/:section' : '');
  if (/^\/projects\/[^/]+\//.test(path)) return '/projects/:city/:project';
  if (/^\/blogs\/[^/]+/.test(path)) return '/blogs/:slug';
  if (/-for-(sale|rent|lease)-in-/.test(path))
    return '/:type-for-:intent-in-:location';
  return path;
}
