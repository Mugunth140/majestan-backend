import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PropertyFile } from './property-file.entity';
import { User } from './user.entity';

export enum StorageProvider {
  R2 = 'r2',
}

@Entity('files')
@Unique('uq_files_file_key', ['fileKey'])
@Index('idx_files_uploaded_by', ['uploadedBy'])
@Index('idx_files_mime_type', ['mimeType'])
@Index('idx_files_created_at', ['createdAt'])
export class FileEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'uploaded_by', type: 'int', unsigned: true, nullable: true })
  uploadedBy!: number | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: false })
  fileName!: string;

  @Column({ name: 'file_extension', type: 'varchar', length: 20, nullable: true })
  fileExtension!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: false })
  mimeType!: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', unsigned: true, nullable: false })
  fileSizeBytes!: string;

  @Column({ name: 'file_url', type: 'varchar', length: 1024, nullable: false })
  fileUrl!: string;

  @Column({ name: 'file_key', type: 'varchar', length: 1024, nullable: false })
  fileKey!: string;

  @Column({
    name: 'storage_provider',
    type: 'enum',
    enum: StorageProvider,
    nullable: false,
    default: StorageProvider.R2,
  })
  storageProvider!: StorageProvider;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64, nullable: true })
  checksumSha256!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => User, {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'uploaded_by', referencedColumnName: 'id' })
  uploadedByUser!: Promise<User | null>;

  @OneToMany(() => PropertyFile, (propertyFile) => propertyFile.file, { lazy: true })
  propertyFiles!: Promise<PropertyFile[]>;
}
