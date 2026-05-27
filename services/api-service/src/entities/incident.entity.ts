import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('incidents')
export class Incident {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @Column()
  streamId: string;

  @Column()
  type: string;

  @Column()
  severity: string;

  @Column()
  status: string;

  @Column()
  title: string;

  @Column({ type: 'timestamptz' })
  detectedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column('double precision')
  triggerValue: number;

  @Column('double precision')
  triggerThreshold: number;

  @Column({ type: 'timestamptz', nullable: true })
  signalWindowStart: Date;

  @Column({ type: 'timestamptz', nullable: true })
  signalWindowEnd: Date;
}
