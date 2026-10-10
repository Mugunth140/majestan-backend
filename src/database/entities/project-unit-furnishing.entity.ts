import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { FurnishingItem } from './furnishing-item.entity';
import { ProjectUnit } from './project-unit.entity';

@Entity('project_unit_furnishings')
@Index('idx_project_unit_furnishings_item_id', ['furnishingItemId'])
export class ProjectUnitFurnishing {
  @PrimaryColumn({ name: 'unit_id', type: 'int', unsigned: true })
  unitId!: number;

  @PrimaryColumn({ name: 'furnishing_item_id', type: 'int', unsigned: true })
  furnishingItemId!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @ManyToOne(() => ProjectUnit, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'unit_id', referencedColumnName: 'id' })
  unit!: Promise<ProjectUnit>;

  @ManyToOne(() => FurnishingItem, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'furnishing_item_id', referencedColumnName: 'id' })
  furnishingItem!: Promise<FurnishingItem>;
}
