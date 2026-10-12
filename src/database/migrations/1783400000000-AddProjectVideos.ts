import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds titled project videos ({ title, url }[]), superseding the plain
 * `video_urls` list, and backfills every existing link as an untitled video
 * so no project loses its video. `video_urls` stays: saves keep mirroring it.
 *
 * The backfill runs row by row in TypeScript rather than with JSON_TABLE so
 * it behaves the same on MySQL and MariaDB.
 */
export class AddProjectVideos1783400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('projects', 'videos'))) {
      await queryRunner.query('ALTER TABLE `projects` ADD COLUMN `videos` json NULL');
    }

    const rows: { id: number; video_urls: unknown }[] = await queryRunner.query(
      'SELECT `id`, `video_urls` FROM `projects` WHERE `video_urls` IS NOT NULL AND `videos` IS NULL',
    );
    for (const row of rows) {
      const raw = typeof row.video_urls === 'string' ? JSON.parse(row.video_urls) : row.video_urls;
      if (!Array.isArray(raw)) continue;
      const videos = raw
        .map((url) => String(url ?? '').trim())
        .filter(Boolean)
        .map((url) => ({ title: null, url }));
      if (videos.length === 0) continue;
      await queryRunner.query('UPDATE `projects` SET `videos` = ? WHERE `id` = ?', [
        JSON.stringify(videos),
        row.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `projects` DROP COLUMN `videos`');
  }
}
