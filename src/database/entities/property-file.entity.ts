import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { FileEntity } from './file.entity';
import { Property } from './property.entity';

export enum PropertyDocumentType {
  BROCHURE = 'brochure',
  FLOOR_PLAN = 'floor_plan',
  LEGAL_DOCUMENT = 'legal_document',
  OWNERSHIP_PROOF = 'ownership_proof',
  APPROVAL_CERTIFICATE = 'approval_certificate',
  TAX_RECEIPT = 'tax_receipt',
  VIDEO_TOUR = 'video_tour',
  OTHER = 'other',
}

@Entity('property_files')
@Unique('uq_property_files_property_file', ['propertyId', 'fileId'])
@Index('idx_property_files_property_id', ['propertyId'])
@Index('idx_property_files_file_id', ['fileId'])
@Index('idx_property_files_document_type', ['documentType'])
@Index('idx_property_files_is_public', ['isPublic'])
export class PropertyFile {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @Column({ name: 'file_id', type: 'int', unsigned: true, nullable: false })
  fileId!: number;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: PropertyDocumentType,
    nullable: false,
    default: PropertyDocumentType.OTHER,
  })
  documentType!: PropertyDocumentType;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'is_public', type: 'boolean', nullable: false, default: false })
  isPublic!: boolean;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, nullable: false, default: 0 })
  sortOrder!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => Property, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;

  @ManyToOne(() => FileEntity, (file) => file.propertyFiles, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'file_id', referencedColumnName: 'id' })
  file!: Promise<FileEntity>;
}
