import { Injectable, Logger } from '@nestjs/common';

export interface ForwardEnquiryArgs {
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  source?: string;
  propertyType?: string;
  listingType?: string;
  location?: string;
  preferences?: Record<string, unknown>;
  pageUrl?: string;
  [key: string]: unknown;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function propertyLabelFromPageUrl(pageUrl?: string): string | undefined {
  if (!pageUrl) {
    return undefined;
  }
  try {
    const lower = String(pageUrl).toLowerCase();
    if (lower.includes('independent-houses')) {
      return 'Individual Houses';
    }
    if (lower.includes('commercial-spaces')) {
      return 'Commercial Spaces';
    }
    if (lower.includes('industrial-spaces')) {
      return 'Industrial Spaces';
    }
    if (lower.includes('apartments')) {
      return 'Apartments';
    }
    if (lower.includes('villas')) {
      return 'Villas';
    }
    if (lower.includes('plots')) {
      return 'Plots';
    }
    if (lower.includes('farmlands')) {
      return 'Farmlands';
    }
    if (lower.includes('coworking')) {
      return 'Coworking';
    }
    if (lower.includes('properties')) {
      return 'Properties';
    }
    return undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class CrmForwardingService {
  private readonly logger = new Logger(CrmForwardingService.name);

  async forwardEnquiry(
    args: ForwardEnquiryArgs,
    attempt = 1,
  ): Promise<void> {
    const serviceKey = process.env.SITE_TO_CRM_SERVICE_KEY;
    if (!serviceKey) {
      this.logger.warn(
        'SITE_TO_CRM_SERVICE_KEY unset — skipping CRM forward',
      );
      return;
    }

    const base = (
      process.env.CRM_BASE_URL || 'http://localhost:8000/api/v1'
    ).replace(/\/+$/, '');
    const url = `${base}/leads/website`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': serviceKey,
        },
        body: JSON.stringify({ ...args, whatsapp: args.mobile }),
      });
      if (!res.ok) {
        throw new Error(`CRM forward failed with status ${res.status}`);
      }
    } catch (err) {
      if (attempt < 2) {
        await sleep(1000);
        return this.forwardEnquiry(args, attempt + 1);
      }
      const masked = `******${String(args?.mobile ?? '').slice(-2)}`;
      this.logger.error(
        `Failed to forward enquiry to CRM for ${masked} source=${String(
          (args as ForwardEnquiryArgs)?.source ?? 'unknown',
        )}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
