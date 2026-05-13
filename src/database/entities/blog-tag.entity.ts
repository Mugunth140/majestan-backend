import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Blog } from './blog.entity';
import { Tag } from './tag.entity';

@Entity('blog_tags')
@Index('idx_blog_tags_blog_id', ['blogId'])
@Index('idx_blog_tags_tag_id', ['tagId'])
export class BlogTag {
  @PrimaryColumn({ name: 'blog_id', type: 'int', unsigned: true })
  blogId!: number;

  @PrimaryColumn({ name: 'tag_id', type: 'int', unsigned: true })
  tagId!: number;

  @ManyToOne(() => Blog, (blog) => blog.blogTags, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'blog_id', referencedColumnName: 'id' })
  blog!: Promise<Blog>;

  @ManyToOne(() => Tag, (tag) => tag.blogTags, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tag_id', referencedColumnName: 'id' })
  tag!: Promise<Tag>;
}
