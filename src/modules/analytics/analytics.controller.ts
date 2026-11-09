import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Header,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { isInternalRequest } from '../../common/guards/site-throttler.guard';
import { ANALYTICS_HOSTS, validateBatch } from './analytics-event';
import { SiteAnalyticsStore } from './analytics-store.service';

@Injectable()
export class AnalyticsReadGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('SITE_ANALYTICS_READ_KEY', '');
    const value = req.get('x-analytics-key') ?? '';
    if (
      !expected ||
      !value ||
      Buffer.byteLength(value) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
    )
      throw new UnauthorizedException();
    return true;
  }
}

@Public()
@Controller('analytics')
export class SiteAnalyticsController {
  constructor(private readonly store: SiteAnalyticsStore) {}

  @Post('events')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async collect(@Body() body: unknown, @Req() req: Request) {
    // Only the same-origin Next handler injects this key. Never send it to JS.
    if (!isInternalRequest(req)) throw new UnauthorizedException();
    let origin: URL;
    try {
      origin = new URL(req.get('origin') ?? '');
    } catch {
      throw new ForbiddenException('Invalid analytics origin');
    }
    const local =
      process.env.NODE_ENV !== 'production' &&
      ['localhost', '127.0.0.1'].includes(origin.hostname);
    if (
      !(
        origin.protocol === 'https:' &&
        ANALYTICS_HOSTS.has(origin.hostname) &&
        !origin.port
      ) &&
      !local
    )
      throw new ForbiddenException('Invalid analytics origin');
    if (req.get('dnt') === '1' || req.get('sec-gpc') === '1')
      return { accepted: 0 };
    const ua = req.get('user-agent') ?? '';
    if (
      !ua ||
      /bot|crawler|spider|headless|slurp|preview|facebookexternalhit|lighthouse/i.test(
        ua,
      )
    )
      return { accepted: 0 };
    const events = validateBatch(body);
    const hostname = local ? 'www.majestanrealty.com' : origin.hostname;
    if (events.some((e) => e.hostname !== hostname))
      throw new ForbiddenException('Analytics host mismatch');
    return this.store.ingest(events, {
      ip: req.get('x-client-ip') || req.socket.remoteAddress || 'unknown',
      ua,
      country: req.get('x-analytics-country'),
    });
  }

  @Get('report')
  @UseGuards(AnalyticsReadGuard)
  @Header('Cache-Control', 'no-store')
  report(@Query('from') from: string, @Query('to') to: string) {
    return this.store.report(from, to);
  }

  @Get('property-insights')
  @UseGuards(AnalyticsReadGuard)
  @Header('Cache-Control', 'no-store')
  propertyInsights(@Query('from') from: string, @Query('to') to: string) {
    return this.store.propertyInsights(from, to);
  }

  @Get('status')
  @UseGuards(AnalyticsReadGuard)
  @Header('Cache-Control', 'no-store')
  status() {
    return this.store.status();
  }
}
