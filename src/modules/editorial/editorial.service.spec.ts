import { BadRequestException, ConflictException } from '@nestjs/common';
import { EditorialService } from './editorial.service';
import { SavePostDto } from './editorial.dto';
import { cleanContent } from './editorial-content';
const dto = (): SavePostDto => ({
  title: 'Buying a home',
  slug: 'buying-a-home',
  excerpt: 'A practical guide',
  content: '<h2>Plan</h2><p>Start here.</p>',
  author_name: 'Majestan Realty',
  category: 'Guides',
  cover_image: 'https://example.com/cover.jpg',
  cover_alt: 'A home in Coimbatore',
  meta_title: '',
  meta_description: '',
  social_image: '',
  noindex: false,
  status: 'draft',
});
describe('Editorial publishing', () => {
  let query: jest.Mock, transaction: jest.Mock, service: EditorialService;
  beforeEach(() => {
    query = jest.fn();
    transaction = jest.fn(async (fn) => fn({ query }));
    service = new EditorialService({ query, transaction } as any);
  });
  it('strips scripts, event handlers and unsafe URLs while preserving rich content', () => {
    const html = cleanContent(
      '<script>alert(1)</script><h2>Guide</h2><table><tr><td>A</td></tr></table><img src="javascript:alert(1)" onerror="alert(2)"><a href="javascript:alert(3)">bad</a><p style="text-align:center;color:red">Text</p>',
    );
    expect(html).not.toMatch(/script|onerror|javascript|color:/);
    expect(html).toContain('<h2>Guide</h2>');
    expect(html).toContain('<table>');
    expect(html).toContain('text-align:center');
  });
  it('filters drafts and scheduled posts from public lists and clamps pagination', async () => {
    query.mockResolvedValueOnce([{ total: 0 }]).mockResolvedValueOnce([]);
    await service.list(-9, 999);
    expect(query.mock.calls[0][0]).toContain(
      "status = 'published' AND published_at <= UTC_TIMESTAMP()",
    );
    expect(query.mock.calls[1][1]).toEqual([100, 0]);
  });
  it('excludes noindex posts from the sitemap', async () => {
    query.mockResolvedValue([]);
    await service.sitemap();
    expect(query.mock.calls[0][0]).toContain('AND noindex = 0');
  });
  it('never exposes drafts or future posts through detail URLs', async () => {
    query.mockResolvedValue([]);
    await expect(service.details('hidden')).rejects.toThrow(
      'Blog post not found',
    );
    expect(query.mock.calls[0][0]).toContain(
      "status = 'published' AND published_at <= UTC_TIMESTAMP()",
    );
  });
  it('rejects publishing without text or image alt text', async () => {
    await expect(
      service.save({ ...dto(), status: 'published', cover_alt: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.save({
        ...dto(),
        status: 'published',
        content: '<script>unsafe</script>',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('keeps published URLs stable', async () => {
    query.mockResolvedValueOnce([
      {
        ...dto(),
        id: 1,
        status: 'published',
        published_at: '2026-01-01T00:00:00.000Z',
        revision: 1,
      },
    ]);
    await expect(
      service.save({ ...dto(), slug: 'changed', revision: 1 }, 1),
    ).rejects.toThrow('Published slugs cannot be changed');
  });
  it('requires a revision and rejects stale saves', async () => {
    query.mockResolvedValue([{ ...dto(), id: 1, revision: 2 }]);
    await expect(service.save(dto(), 1)).rejects.toThrow(
      'Revision is required',
    );
    query
      .mockReset()
      .mockResolvedValueOnce([{ ...dto(), id: 1, revision: 2 }])
      .mockResolvedValueOnce({ affectedRows: 0 });
    await expect(
      service.save({ ...dto(), revision: 1 }, 1),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('stores publication timestamps in UTC regardless of the host timezone', async () => {
    query
      .mockResolvedValueOnce({ insertId: 1 })
      .mockResolvedValueOnce([{ ...dto(), id: 1 }]);
    await service.save({ ...dto(), published_at: '2026-10-26T21:30:00+05:30' });
    expect(query.mock.calls[0][1][13]).toBe('2026-10-26 16:00:00');
  });
  it('converts duplicate slugs to an actionable conflict', async () => {
    query.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(service.save(dto())).rejects.toThrow(
      'That URL slug is already in use',
    );
  });
  it('content edits use the organization author and preserve SEO, URL and publication date', async () => {
    const previous = {
      ...dto(),
      id: 1,
      slug: 'fixed-url',
      author_name: 'Original author',
      meta_title: 'SEO managed separately',
      meta_keywords: 'Coimbatore, buying guides',
      meta_description: 'Search description',
      social_image: 'https://cdn.example/social.png',
      noindex: true,
      published_at: '2026-01-01T00:00:00.000Z',
      revision: 2,
    };
    jest.spyOn(service, 'details').mockResolvedValue(previous);
    const save = jest.spyOn(service, 'save').mockResolvedValue(previous);
    const {
      title,
      excerpt,
      content,
      category,
      cover_image,
      cover_alt,
      status,
    } = dto();
    await service.saveContent(
      {
        title,
        excerpt,
        content,
        category,
        cover_image,
        cover_alt,
        status,
        revision: 2,
        author_name: 'Another editor',
      },
      1,
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        author_name: 'Majestan Realty',
        slug: 'fixed-url',
        meta_title: previous.meta_title,
        meta_keywords: previous.meta_keywords,
        noindex: true,
        published_at: previous.published_at,
      }),
      1,
    );
  });
  it('new content gets an automatic URL and author without requesting SEO fields', async () => {
    const save = jest.spyOn(service, 'save').mockResolvedValue({ id: 1 });
    const {
      title,
      excerpt,
      content,
      category,
      cover_image,
      cover_alt,
      status,
    } = dto();
    await service.saveContent({
      title,
      excerpt,
      content,
      category,
      cover_image,
      cover_alt,
      status,
      author_name: 'CRM author',
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        author_name: 'Majestan Realty',
        slug: expect.stringMatching(/^buying-a-home-[a-f0-9]{8}$/),
        meta_title: '',
        noindex: false,
        published_at: null,
      }),
      undefined,
    );
  });
  it('SEO edits update SEO fields only and reject a stale revision', async () => {
    jest
      .spyOn(service, 'details')
      .mockResolvedValue({ ...dto(), id: 1, published_at: null });
    query.mockResolvedValue({ affectedRows: 0 });
    await expect(
      service.saveSeo(1, {
        slug: 'buying-a-home',
        meta_title: 'New SEO title',
        meta_description: 'Search description',
        social_image: '',
        noindex: true,
        revision: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls[0][0]).not.toMatch(
      /content =|author_name =|published_at =/,
    );
  });
  it('saves keywords and preserves them for older SEO clients that omit the field', async () => {
    jest
      .spyOn(service, 'details')
      .mockResolvedValue({
        ...dto(),
        id: 1,
        meta_keywords: 'Existing keyword',
      });
    query.mockResolvedValue({ affectedRows: 1 });
    const seo = {
      slug: 'buying-a-home',
      meta_title: '',
      meta_description: '',
      social_image: '',
      noindex: false,
      revision: 1,
    };
    await service.saveSeo(1, {
      ...seo,
      meta_keywords: ' Buying guides, Coimbatore ',
    });
    expect(query.mock.calls[0][0]).toContain('meta_keywords = ?');
    expect(query.mock.calls[0][1][3]).toBe('Buying guides, Coimbatore');
    await service.saveSeo(1, seo);
    expect(query.mock.calls[1][1][3]).toBe('Existing keyword');
  });
  it('renames a published slug atomically and flattens its previous redirects', async () => {
    const previous = {
      ...dto(),
      id: 1,
      revision: 3,
      published_at: '2026-01-01T00:00:00.000Z',
    };
    jest.spyOn(service, 'details').mockResolvedValue(previous);
    query
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce([])
      .mockResolvedValue({ affectedRows: 1 });
    await service.saveSeo(1, {
      slug: 'new-home-guide',
      meta_title: '',
      meta_description: '',
      social_image: '',
      noindex: false,
      revision: 3,
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          sql.startsWith('UPDATE seo_redirects') &&
          params[0] === '/blogs/new-home-guide' &&
          params[1] === '/blogs/buying-a-home',
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          sql.startsWith('INSERT INTO seo_redirects') &&
          params[0] === '/blogs/buying-a-home' &&
          params[1] === '/blogs/new-home-guide',
      ),
    ).toBe(true);
  });
  it('does not overwrite another article or a reserved redirect', async () => {
    const previous = {
      ...dto(),
      id: 1,
      revision: 1,
      published_at: '2026-01-01T00:00:00.000Z',
    };
    jest.spyOn(service, 'details').mockResolvedValue(previous);
    query.mockResolvedValueOnce([previous]).mockResolvedValueOnce([{ id: 2 }]);
    await expect(
      service.saveSeo(1, {
        slug: 'occupied',
        meta_title: '',
        meta_description: '',
        social_image: '',
        noindex: false,
        revision: 1,
      }),
    ).rejects.toThrow('already in use');
    query
      .mockReset()
      .mockResolvedValueOnce([previous])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { reason: 'manual', destination_path: '/blogs/other' },
      ]);
    await expect(
      service.saveSeo(1, {
        slug: 'reserved',
        meta_title: '',
        meta_description: '',
        social_image: '',
        noindex: false,
        revision: 1,
      }),
    ).rejects.toThrow('reserved');
  });
  it('resolves live redirect targets without exposing unpublished posts', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ slug: 'new-guide' }]);
    await expect(service.resolveSlug('old-guide')).resolves.toEqual({
      slug: 'new-guide',
    });
    expect(query.mock.calls[1][0]).toContain("p.status = 'published'");
    query.mockReset().mockResolvedValue([]);
    await expect(service.resolveSlug('private-old-guide')).resolves.toEqual({
      slug: null,
    });
  });
  it('requires the current revision to delete', async () => {
    await expect(service.remove(1, 0)).rejects.toThrow('Revision is required');
    query.mockResolvedValue({ affectedRows: 0 });
    await expect(service.remove(1, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
