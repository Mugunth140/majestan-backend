import { GoogleReviewsService, REVIEW_MAX_SHOWN, selectBestReviews } from './google-reviews.service';

const review = (over: Record<string, unknown> = {}) => ({
  author_name: 'A',
  rating: 5,
  text: 'x'.repeat(80),
  time: 1,
  relative_time_description: 'a month ago',
  ...over,
});

describe('selectBestReviews', () => {
  it('drops low ratings, short text and duplicates', () => {
    const picked = selectBestReviews([
      review({ author_name: 'Good', time: 1 }),
      review({ author_name: 'Good', time: 1 }),
      review({ author_name: 'Low', rating: 2, time: 2 }),
      review({ author_name: 'Short', text: 'ok', time: 3 }),
    ]);
    expect(picked.map((r) => r.authorName)).toEqual(['Good']);
  });

  it('ranks by rating, then by how detailed the review is, and caps the count', () => {
    const picked = selectBestReviews([
      review({ author_name: 'Four', rating: 4, text: 'y'.repeat(400), time: 1 }),
      review({ author_name: 'FiveShort', text: 'z'.repeat(70), time: 2 }),
      review({ author_name: 'FiveLong', text: 'w'.repeat(300), time: 3 }),
      ...Array.from({ length: 8 }, (_, i) => review({ author_name: `More${i}`, time: 10 + i })),
    ]);
    expect(picked).toHaveLength(REVIEW_MAX_SHOWN);
    expect(picked[0].authorName).toBe('FiveLong');
    expect(picked.some((r) => r.authorName === 'Four')).toBe(false);
  });
});

describe('GoogleReviewsService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  const config = (values: Record<string, string>) => ({ get: (k: string) => values[k] }) as any;

  it('hides the section when no API key is configured', async () => {
    const service = new GoogleReviewsService(config({}));
    await expect(service.get()).resolves.toBeNull();
  });

  it('merges both sorts, then serves from cache', async () => {
    const result = { rating: 4.8, user_ratings_total: 31, url: 'https://maps.google.com/?cid=1', reviews: [review()] };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'OK', result }) });
    global.fetch = fetchMock as any;
    const service = new GoogleReviewsService(config({ GOOGLE_MAPS_API_KEY: 'k' }));

    const first = await service.get();
    await service.get();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ rating: 4.8, total: 31, reviews: [{ authorName: 'A' }] });
  });

  it('returns null rather than throwing when Google fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    const service = new GoogleReviewsService(config({ GOOGLE_MAPS_API_KEY: 'k' }));
    await expect(service.get()).resolves.toBeNull();
  });
});
