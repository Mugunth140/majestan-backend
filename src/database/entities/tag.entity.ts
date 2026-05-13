import { Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Blog } from './blog.entity';
import { BlogTag } from './blog-tag.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @ManyToMany(() => Blog, (blog) => blog.tags, { lazy: true })
  blogs!: Promise<Blog[]>;

  @OneToMany(() => BlogTag, (blogTag) => blogTag.tag, { lazy: true })
  blogTags!: Promise<BlogTag[]>;
}
