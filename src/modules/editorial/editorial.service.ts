import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  SavePostDto,
  SaveBlogContentDto,
  SaveBlogSeoDto,
} from './editorial.dto';
import { cleanContent, contentText, safeImageUrl } from './editorial-content';

// DATETIME values are UTC. Explicit conversion avoids the MySQL driver's
// host-local timezone changing publication time on non-UTC servers.
const utcColumn = (name: string) =>
  `DATE_FORMAT(${name}, '%Y-%m-%dT%H:%i:%s.000Z') AS ${name}`;
const BLOG_AUTHOR = 'Majestan Realty';
const LIVE = "status = 'published' AND published_at <= UTC_TIMESTAMP()";
@Injectable()
export class EditorialService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}
  async list(page = 1, limit = 12, admin = false) {
    page = Math.max(1, Math.min(100000, Math.floor(Number(page) || 1)));
    limit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 12)));
    const where = admin ? '' : `WHERE ${LIVE}`;
    const [count] = await this.db.query(
      `SELECT COUNT(*) total FROM blog_posts ${where}`,
    );
    const items = await this.db.query(
      `SELECT id,title,slug,excerpt,author_name,category,cover_image,cover_alt,meta_title,meta_description,meta_keywords,noindex,status,${utcColumn('published_at')},${utcColumn('updated_at')},revision FROM blog_posts ${where} ORDER BY ${admin ? 'updated_at' : 'published_at'} DESC, id DESC LIMIT ? OFFSET ?`,
      [limit, (page - 1) * limit],
    );
    return {
      items: items.map((post) => ({ ...post, author_name: BLOG_AUTHOR })),
      total: Number(count.total),
      page,
      limit,
    };
  }
  async sitemap() {
    return this.db.query(
      `SELECT slug,${utcColumn('updated_at')} FROM blog_posts WHERE ${LIVE} AND noindex = 0 ORDER BY id`,
    );
  }
  async details(key: string | number, admin = false) {
    const [post] = await this.db.query(
      `SELECT *,${utcColumn('published_at')},${utcColumn('updated_at')},${utcColumn('created_at')} FROM blog_posts WHERE ${admin ? 'id' : 'slug'} = ? ${admin ? '' : `AND ${LIVE}`} LIMIT 1`,
      [key],
    );
    if (!post) throw new NotFoundException('Blog post not found');
    post.author_name = BLOG_AUTHOR;
    post.noindex = Boolean(post.noindex);
    // Also sanitize on read to protect against manually imported HTML.
    post.content = cleanContent(post.content);
    return post;
  }
  async save(dto: SavePostDto, id?: number) {
    const content = cleanContent(dto.content);
    const title = dto.title.trim(),
      author = BLOG_AUTHOR;
    if (!title || !author)
      throw new BadRequestException('Title and author are required');
    if (![dto.cover_image, dto.social_image].every(safeImageUrl))
      throw new BadRequestException(
        'Images must use absolute HTTP or HTTPS URLs',
      );
    if (
      dto.status === 'published' &&
      (!contentText(content) ||
        !dto.excerpt.trim() ||
        !dto.cover_image ||
        !dto.cover_alt.trim())
    ) {
      throw new BadRequestException(
        'Publishing requires article text, description, cover image and cover alt text',
      );
    }
    const previous = id ? await this.details(id, true) : null;
    if (previous && previous.published_at && previous.slug !== dto.slug)
      throw new BadRequestException(
        'Published slugs cannot be changed. Keep the existing URL for SEO.',
      );
    if (id && !dto.revision)
      throw new BadRequestException('Revision is required when updating');
    const publication = dto.published_at
      ? new Date(dto.published_at)
      : dto.status === 'published'
        ? new Date()
        : previous?.published_at
          ? new Date(previous.published_at)
          : null;
    const published = publication
      ? publication.toISOString().slice(0, 19).replace('T', ' ')
      : null;
    const values = [
      title,
      dto.slug,
      dto.excerpt.trim(),
      content,
      author,
      dto.category.trim(),
      dto.cover_image,
      dto.cover_alt.trim(),
      dto.meta_title.trim(),
      dto.meta_description.trim(),
      dto.social_image,
      dto.noindex,
      dto.status,
      published,
      dto.meta_keywords?.trim() || '',
    ];
    const fields = [
      'title',
      'slug',
      'excerpt',
      'content',
      'author_name',
      'category',
      'cover_image',
      'cover_alt',
      'meta_title',
      'meta_description',
      'social_image',
      'noindex',
      'status',
      'published_at',
      'meta_keywords',
    ];
    try {
      if (id) {
        const result = await this.db.query(
          `UPDATE blog_posts SET ${fields.map((f) => `${f} = ?`).join(',')}, revision = revision + 1, updated_at = UTC_TIMESTAMP() WHERE id = ? AND revision = ?`,
          [...values, id, dto.revision],
        );
        if (!result.affectedRows)
          throw new ConflictException(
            'This post changed in another session. Reload it before saving.',
          );
      } else {
        const result = await this.db.query(
          `INSERT INTO blog_posts (${fields.join(',')},created_at,updated_at) VALUES (${fields.map(() => '?').join(',')},UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
          values,
        );
        id = result.insertId;
      }
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new ConflictException('That URL slug is already in use');
      throw e;
    }
    return this.details(id!, true);
  }
  async saveContent(dto: SaveBlogContentDto, id?: number) {
    const previous = id ? await this.details(id, true) : null;
    const generated =
      dto.title
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 140) || 'article';
    // The suffix prevents title collisions while keeping readable, stable URLs.
    const slug =
      previous?.slug || `${generated}-${crypto.randomUUID().slice(0, 8)}`;
    return this.save(
      {
        ...dto,
        slug,
        author_name: BLOG_AUTHOR,
        meta_title: previous?.meta_title || '',
        meta_description: previous?.meta_description || '',
        meta_keywords: previous?.meta_keywords || '',
        social_image: previous?.social_image || '',
        noindex: Boolean(previous?.noindex),
        // New publications get the actual first publication time, automatically.
        published_at: previous?.published_at || null,
      },
      id,
    );
  }
  async resolveSlug(slug: string) {
    const [current] = await this.db.query(
      `SELECT slug FROM blog_posts WHERE slug = ? AND ${LIVE} LIMIT 1`,
      [slug],
    );
    if (current) return { slug: current.slug };
    const [alias] = await this.db.query(
      `SELECT p.slug FROM seo_redirects r JOIN blog_posts p ON r.destination_path = CONCAT('/blogs/',p.slug) WHERE r.source_path = ? AND r.reason = 'blog-slug' AND r.is_active = 1 AND p.status = 'published' AND p.published_at <= UTC_TIMESTAMP() LIMIT 1`,
      ['/blogs/' + slug],
    );
    return { slug: alias?.slug || null };
  }
  async saveSeo(id: number, dto: SaveBlogSeoDto) {
    const previous = await this.details(id, true);
    if (!safeImageUrl(dto.social_image))
      throw new BadRequestException(
        'Social images must use absolute HTTP or HTTPS URLs',
      );
    const sql =
      'UPDATE blog_posts SET slug = ?, meta_title = ?, meta_description = ?, meta_keywords = ?, social_image = ?, noindex = ?, revision = revision + 1, updated_at = UTC_TIMESTAMP() WHERE id = ? AND revision = ?';
    const values = [
      dto.slug,
      dto.meta_title.trim(),
      dto.meta_description.trim(),
      dto.meta_keywords === undefined
        ? previous.meta_keywords || ''
        : dto.meta_keywords.trim(),
      dto.social_image,
      dto.noindex,
      id,
      dto.revision,
    ];
    const stale = () =>
      new ConflictException(
        'This post changed in another session. Reload it before saving.',
      );
    try {
      if (previous.slug === dto.slug) {
        const result = await this.db.query(sql, values);
        if (!result.affectedRows) throw stale();
      } else {
        await this.db.transaction(async (manager) => {
          const [locked] = await manager.query(
            'SELECT id,slug,revision,published_at FROM blog_posts WHERE id = ? FOR UPDATE',
            [id],
          );
          if (
            !locked ||
            locked.revision !== dto.revision ||
            locked.slug !== previous.slug
          )
            throw stale();
          const oldPath = '/blogs/' + previous.slug,
            newPath = '/blogs/' + dto.slug;
          const [occupied] = await manager.query(
            'SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1',
            [dto.slug, id],
          );
          if (occupied)
            throw new ConflictException('That URL slug is already in use');
          const [reserved] = await manager.query(
            'SELECT reason,destination_path FROM seo_redirects WHERE source_path = ? AND is_active = 1 FOR UPDATE',
            [newPath],
          );
          if (
            reserved &&
            !(
              reserved.reason === 'blog-slug' &&
              reserved.destination_path === oldPath
            )
          )
            throw new ConflictException(
              'That URL is reserved by an existing redirect',
            );
          const result = await manager.query(sql, values);
          if (!result.affectedRows) throw stale();
          if (locked.published_at) {
            const [oldRule] = await manager.query(
              'SELECT reason FROM seo_redirects WHERE source_path = ? FOR UPDATE',
              [oldPath],
            );
            if (oldRule && oldRule.reason !== 'blog-slug')
              throw new ConflictException(
                'The old URL has an existing redirect. Review it in Technical SEO first.',
              );
            // Reclaiming one of this article's old URLs must not form a loop.
            await manager.query(
              "DELETE FROM seo_redirects WHERE source_path = ? AND reason = 'blog-slug'",
              [newPath],
            );
            await manager.query(
              "UPDATE seo_redirects SET destination_path = ?, updated_at = UTC_TIMESTAMP() WHERE destination_path = ? AND reason = 'blog-slug'",
              [newPath, oldPath],
            );
            await manager.query(
              "INSERT INTO seo_redirects (source_path,destination_path,reason,is_active) VALUES (?,?,'blog-slug',1) ON DUPLICATE KEY UPDATE destination_path=VALUES(destination_path),is_active=1,updated_at=UTC_TIMESTAMP()",
              [oldPath, newPath],
            );
          }
        });
      }
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new ConflictException('That URL slug is already in use');
      throw e;
    }
    return this.details(id, true);
  }
  async remove(id: number, revision: number) {
    if (!Number.isInteger(revision) || revision < 1)
      throw new BadRequestException('Revision is required');
    const result = await this.db.query(
      'DELETE FROM blog_posts WHERE id = ? AND revision = ?',
      [id, revision],
    );
    if (!result.affectedRows)
      throw new ConflictException(
        'Post changed or was deleted. Reload before deleting.',
      );
    return { deleted: true };
  }
}
