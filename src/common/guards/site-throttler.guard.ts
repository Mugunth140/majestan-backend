import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { timingSafeEqual } from 'node:crypto';

/** Header the site frontend's server adds to its own calls (see INTERNAL_API_KEY). */
export const INTERNAL_KEY_HEADER = 'x-internal-key';
/** Visitor IP the frontend's /site-api proxy forwards with the key. */
export const CLIENT_IP_HEADER = 'x-client-ip';

type HeaderBag = { headers?: Record<string, string | string[] | undefined> };

const header = (req: HeaderBag, name: string): string => {
  const value = req.headers?.[name];
  const first = Array.isArray(value) ? value[0] : value;
  return (first ?? '').trim();
};

/** True when the request carries the shared INTERNAL_API_KEY. */
export function isInternalRequest(req: HeaderBag): boolean {
  const expected = process.env.INTERNAL_API_KEY ?? '';
  const given = header(req, INTERNAL_KEY_HEADER);
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Rate limiting that understands the site frontend sits in front of this API.
 *
 * Every request from the frontend container shares one IP, so the plain
 * per-IP limit made all visitors (and any crawler) share a single budget:
 * one aggressive bot exhausted it and real visitors got error pages.
 *
 * - Server-side rendering calls (key, no visitor IP): not limited; the page
 *   request itself is what a visitor or bot makes, and Caddy fronts that.
 * - Browser calls proxied through /site-api (key + visitor IP): limited per
 *   visitor IP.
 * - Anything else (no valid key): limited per connecting IP, as before.
 *
 * Without INTERNAL_API_KEY set this behaves exactly like ThrottlerGuard.
 */
@Injectable()
export class SiteThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HeaderBag>();
    return Promise.resolve(
      isInternalRequest(req) && !header(req, CLIENT_IP_HEADER),
    );
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (isInternalRequest(req)) {
      const clientIp = header(req, CLIENT_IP_HEADER);
      if (clientIp) return clientIp;
    }
    return super.getTracker(req);
  }
}
