import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BlogListQueryDto } from './dto/blog-list-query.dto';
import { BlogLikeAction, ToggleBlogLikeDto } from './dto/toggle-blog-like.dto';

type BlogRow = {
  id: number;
  status: number;
  [key: string]: unknown;
};

type BlogMetricColumns = {
  viewColumn: string | null;
  likeColumn: string | null;
};

@Injectable()
export class BlogsService {
  private metricColumnsCache: BlogMetricColumns | null = null;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(query: BlogListQueryDto) {
    const offset = (query.page - 1) * query.limit;

    const baseQuery = this.dataSource
      .createQueryBuilder()
      .from('blogs', 'blogs')
      .where('blogs.status = :status', { status: 1 });

    const total = await baseQuery.clone().getCount();

    const blogs = await baseQuery
      .clone()
      .select('blogs.*')
      .orderBy('blogs.id', 'DESC')
      .limit(query.limit)
      .offset(offset)
      .getRawMany<BlogRow>();

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
      await this.dataSource
        .createQueryBuilder()
        .update('blogs')
        .set({
          [viewColumn]: () => `COALESCE(${viewColumn}, 0) + 1`,
        })
        .where('id = :id', { id })
        .execute();

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
      await this.dataSource
        .createQueryBuilder()
        .update('blogs')
        .set({
          [likeColumn]: () => `GREATEST(COALESCE(${likeColumn}, 0) - 1, 0)`,
        })
        .where('id = :id', { id })
        .execute();
    } else {
      await this.dataSource
        .createQueryBuilder()
        .update('blogs')
        .set({
          [likeColumn]: () => `COALESCE(${likeColumn}, 0) + 1`,
        })
        .where('id = :id', { id })
        .execute();
    }

    const likesRow = await this.dataSource
      .createQueryBuilder()
      .select(`COALESCE(blogs.${likeColumn}, 0)`, 'likes')
      .from('blogs', 'blogs')
      .where('blogs.id = :id', { id })
      .limit(1)
      .getRawOne<{ likes: number | string }>();

    return {
      liked: payload.action !== BlogLikeAction.Unlike,
      likes: Number(likesRow?.likes ?? 0),
    };
  }

  private async getBlogById(id: number): Promise<BlogRow> {
    const blog = await this.dataSource
      .createQueryBuilder()
      .select('blogs.*')
      .from('blogs', 'blogs')
      .where('blogs.id = :id', { id })
      .andWhere('blogs.status = :status', { status: 1 })
      .limit(1)
      .getRawOne<BlogRow>();

    if (!blog) {
      throw new NotFoundException('Blog not found');
    }

    return blog;
  }

  private async resolveMetricColumns(): Promise<BlogMetricColumns> {
    if (this.metricColumnsCache) {
      return this.metricColumnsCache;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    let fieldSet = new Set<string>();

    try {
      const table = await queryRunner.getTable('blogs');
      fieldSet = new Set(
        (table?.columns ?? []).map((column) => column.name.toLowerCase()),
      );
    } finally {
      await queryRunner.release();
    }

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
