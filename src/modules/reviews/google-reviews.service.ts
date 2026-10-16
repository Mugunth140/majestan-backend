import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Majestan Realty's Google Business listing. Public, not a secret. */
const DEFAULT_PLACE_ID = 'ChIJX97GpKpXqDsRcrmAE2D7qIw';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
/** After a failed fetch, wait this long before asking Google again. */
const FAILURE_RETRY_MS = 15 * 60 * 1000;

/** "Best suitable": well-rated reviews with enough text to be worth reading. */
export const REVIEW_MIN_RATING = 4;
export const REVIEW_MIN_LENGTH = 60;
export const REVIEW_MAX_SHOWN = 6;

export type GoogleReview = {
  authorName: string;
  authorUrl: string | null;
  photoUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  time: number;
};

export type GoogleReviews = {
  rating: number;
  total: number;
  /** The listing on Google Maps, for "See all reviews". */
  url: string | null;
  /** Opens Google's write-a-review dialog for the listing. */
  writeReviewUrl: string;
  reviews: GoogleReview[];
};

type PlaceDetailsReview = {
  author_name?: string;
  author_url?: string;
  profile_photo_url?: string;
  rating?: number;
  text?: string;
  relative_time_description?: string;
  time?: number;
};

/** Merge, drop duplicates and keep the best: highest rated, then most detailed. */
export function selectBestReviews(raw: PlaceDetailsReview[]): GoogleReview[] {
  const seen = new Set<string>();
  const unique: GoogleReview[] = [];
  for (const r of raw) {
    const key = `${r.author_name ?? ''}|${r.time ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = (r.text ?? '').trim();
    const rating = Number(r.rating ?? 0);
    if (rating < REVIEW_MIN_RATING || text.length < REVIEW_MIN_LENGTH) continue;
    unique.push({
      authorName: r.author_name?.trim() || 'Google user',
      authorUrl: r.author_url ?? null,
      photoUrl: r.profile_photo_url ?? null,
      rating,
      text,
      relativeTime: r.relative_time_description ?? '',
      time: r.time ?? 0,
    });
  }
  return unique
    .sort((a, b) => b.rating - a.rating || b.text.length - a.text.length || b.time - a.time)
    .slice(0, REVIEW_MAX_SHOWN);
}

/**
 * Reviews for the home page, read live from the Google Places API (Place
 * Details) so the wording is the reviewers' own and stays current. Google
 * returns at most five per request, so the most-relevant and newest sets are
 * merged. Cached in memory; any failure yields null and the section hides.
 */
@Injectable()
export class GoogleReviewsService {
  private readonly logger = new Logger(GoogleReviewsService.name);
  private cache: { value: GoogleReviews | null; expiresAt: number } | null = null;
  private inFlight: Promise<GoogleReviews | null> | null = null;

  constructor(private readonly config: ConfigService) {}

  private get apiKey() {
    return this.config.get<string>('GOOGLE_MAPS_API_KEY') || '';
  }

  private get placeId() {
    return this.config.get<string>('GOOGLE_PLACE_ID') || DEFAULT_PLACE_ID;
  }

  async get(): Promise<GoogleReviews | null> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    if (!this.inFlight) {
      this.inFlight = this.fetchReviews()
        .then((value) => {
          this.cache = { value, expiresAt: Date.now() + (value ? CACHE_TTL_MS : FAILURE_RETRY_MS) };
          return value;
        })
        .finally(() => {
          this.inFlight = null;
        });
    }
    return this.inFlight;
  }

  private async fetchReviews(): Promise<GoogleReviews | null> {
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY is not set; the reviews section is hidden.');
      return null;
    }
    try {
      const [relevant, newest] = await Promise.all([
        this.details('most_relevant'),
        this.details('newest'),
      ]);
      const base = relevant ?? newest;
      if (!base) return null;
      const reviews = selectBestReviews([...(relevant?.reviews ?? []), ...(newest?.reviews ?? [])]);
      if (reviews.length === 0) return null;
      return {
        rating: Number(base.rating ?? 0),
        total: Number(base.user_ratings_total ?? 0),
        url: base.url ?? null,
        writeReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(this.placeId)}`,
        reviews,
      };
    } catch (err) {
      this.logger.error('Failed to fetch Google reviews', err as Error);
      return null;
    }
  }

  private async details(sort: 'most_relevant' | 'newest') {
    const params = new URLSearchParams({
      place_id: this.placeId,
      fields: 'rating,user_ratings_total,url,reviews',
      reviews_sort: sort,
      language: 'en',
      key: this.apiKey,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as
      | { status?: string; error_message?: string; result?: { rating?: number; user_ratings_total?: number; url?: string; reviews?: PlaceDetailsReview[] } }
      | null;
    if (!res.ok || body?.status !== 'OK' || !body.result) {
      this.logger.warn(`Place Details (${sort}) failed: ${body?.status ?? res.status} ${body?.error_message ?? ''}`.trim());
      return null;
    }
    return body.result;
  }
}
