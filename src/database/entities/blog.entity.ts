import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BlogTag } from './blog-tag.entity';
import { Tag } from './tag.entity';
import { User } from './user.entity';

export enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('blogs')
@Unique('uq_blogs_slug', ['slug'])
@Index('idx_blogs_author_id', ['authorId'])
export class Blog {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, nullable: false })
  slug!: string;

  @Column({ name: 'content', type: 'text', nullable: false })
  content!: string;

  @Column({ name: 'author_id', type: 'int', unsigned: true, nullable: false })
  authorId!: number;

  @Column({ name: 'status', type: 'enum', enum: BlogStatus, nullable: false })
  status!: BlogStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.blogs, {
    lazy: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id' })
  author!: Promise<User>;

  @ManyToMany(() => Tag, (tag) => tag.blogs, { lazy: true })
  @JoinTable({
    name: 'blog_tags',
    joinColumn: { name: 'blog_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags!: Promise<Tag[]>;

  @OneToMany(() => BlogTag, (blogTag) => blogTag.blog, { lazy: true })
  blogTags!: Promise<BlogTag[]>;
}
