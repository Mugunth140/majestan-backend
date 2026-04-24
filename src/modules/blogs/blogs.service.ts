import { Injectable, NotFoundException } from '@nestjs/common';
import { RowDataPacket } from 'mysql2/promise';
import { DatabaseService } from '../../database/database.service';
import { BlogListQueryDto } from './dto/blog-list-query.dto';
import { BlogLikeAction, ToggleBlogLikeDto } from './dto/toggle-blog-like.dto';

type BlogRow = RowDataPacket & {
  id: number;
  status: number;
};

type BlogMetricColumns = {
  viewColumn: string | null;
  likeColumn: string | null;
};

@Injectable()
export class BlogsService {
  private metricColumnsCache: BlogMetricColumns | null = null;

  constructor(private readonly databaseService: DatabaseService) {}

  async list(query: BlogListQueryDto) {
    const offset = (query.page - 1) * query.limit;

    const countRows = await this.databaseService.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM blogs WHERE status = 1',
    );
    const total = Number((countRows[0]?.total as number | undefined) ?? 0);

    const blogs = await this.databaseService.query<BlogRow[]>(
      'SELECT * FROM blogs WHERE status = 1 ORDER BY id DESC LIMIT ? OFFSET ?',
      [query.limit, offset],
    );

    return {
      items: blogs,
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async details(id: number) {
    const blog = await this.getBlogById(id);

    const { viewColumn } = await this.resolveMetricColumns();

    if (viewColumn) {
      await this.databaseService.execute(
        `UPDATE blogs SET ${viewColumn} = COALESCE(${viewColumn}, 0) + 1 WHERE id = ?`,
        [id],
      );

      const refreshed = await this.getBlogById(id);
      return refreshed;
    }

    return blog;
  }

  async like(id: number, payload: ToggleBlogLikeDto) {
    await this.getBlogById(id);

    const { likeColumn } = await this.resolveMetricColumns();

    if (!likeColumn) {
      return {
        liked: false,
        likes: null,
        message: 'likes column is not available in blogs table',
      };
    }

    if (payload.action === BlogLikeAction.Unlike) {
      await this.databaseService.execute(
        `
          UPDATE blogs
          SET ${likeColumn} = GREATEST(COALESCE(${likeColumn}, 0) - 1, 0)
          WHERE id = ?
        `,
        [id],
      );
    } else {
      await this.databaseService.execute(
        `UPDATE blogs SET ${likeColumn} = COALESCE(${likeColumn}, 0) + 1 WHERE id = ?`,
        [id],
      );
    }

    const likesRows = await this.databaseService.query<RowDataPacket[]>(
      `SELECT COALESCE(${likeColumn}, 0) AS likes FROM blogs WHERE id = ? LIMIT 1`,
      [id],
    );

    return {
      liked: payload.action !== BlogLikeAction.Unlike,
      likes: Number((likesRows[0]?.likes as number | undefined) ?? 0),
    };
  }

  private async getBlogById(id: number): Promise<BlogRow> {
    const rows = await this.databaseService.query<BlogRow[]>(
      'SELECT * FROM blogs WHERE id = ? AND status = 1 LIMIT 1',
      [id],
    );

    const blog = rows[0];

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return blog;
  }

  private async resolveMetricColumns(): Promise<BlogMetricColumns> {
    if (this.metricColumnsCache) {
      return this.metricColumnsCache;
    }

    const columns = await this.databaseService.query<RowDataPacket[]>(
      'SHOW COLUMNS FROM blogs',
    );
    const fieldSet = new Set(
      columns.map((column) => String(column.Field).toLowerCase()),
    );

    const viewCandidates = ['views', 'view_count', 'total_views'];
    const likeCandidates = ['likes', 'like_count', 'total_likes'];

    const viewColumn =
      viewCandidates.find((column) => fieldSet.has(column)) ?? null;
    const likeColumn =
      likeCandidates.find((column) => fieldSet.has(column)) ?? null;

    this.metricColumnsCache = { viewColumn, likeColumn };
    return this.metricColumnsCache;
  }
}
