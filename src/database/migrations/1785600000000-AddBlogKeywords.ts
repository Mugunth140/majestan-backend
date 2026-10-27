import { MigrationInterface, QueryRunner } from 'typeorm';
export class AddBlogKeywords1785600000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasColumn('blog_posts', 'meta_keywords'))) {
      await runner.query(
        "ALTER TABLE blog_posts ADD COLUMN meta_keywords VARCHAR(1000) NOT NULL DEFAULT '' AFTER meta_description",
      );
    }
  }
  async down(): Promise<void> {
    /* Preserve editorial keywords on rollback. */
  }
}
