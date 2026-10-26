import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateBlogPosts1785400000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE IF NOT EXISTS blog_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  excerpt VARCHAR(500) NOT NULL DEFAULT '',
  content LONGTEXT NOT NULL,
  author_name VARCHAR(120) NOT NULL DEFAULT 'Majestan Realty',
  category VARCHAR(100) NOT NULL DEFAULT 'Property insights',
  cover_image VARCHAR(2048) NOT NULL DEFAULT '',
  cover_alt VARCHAR(255) NOT NULL DEFAULT '',
  meta_title VARCHAR(120) NOT NULL DEFAULT '',
  meta_description VARCHAR(320) NOT NULL DEFAULT '',
  social_image VARCHAR(2048) NOT NULL DEFAULT '',
  noindex TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  UNIQUE KEY uq_blog_posts_slug (slug),
  KEY idx_blog_posts_publication (status, published_at, id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  }
  async down(): Promise<void> {
    /* Editorial content is intentionally preserved. */
  }
}
