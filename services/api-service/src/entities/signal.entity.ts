import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('signals')
export class Signal {
  @PrimaryColumn('uuid')
  signalId: string;

  @PrimaryColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column('uuid')
  projectId: string;

  @Column()
  streamId: string;

  @Column()
  type: string; // LOG | METRIC | TRACE

  @Column({ type: 'timestamptz' })
  receivedAt: Date;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  message: string;

  @Column({ nullable: true })
  metricName: string;

  @Column({ type: 'double precision', nullable: true })
  metricValue: number;

  @Column({ nullable: true })
  metricUnit: string;

  @Column({ nullable: true })
  traceId: string;

  @Column({ nullable: true })
  spanId: string;

  @Column({ nullable: true })
  parentSpanId: string;

  @Column({ nullable: true })
  operationName: string;

  @Column({ type: 'bigint', nullable: true })
  durationMs: string;

  @Column({ nullable: true })
  status: string;

  @Column('jsonb', { nullable: true })
  attributes: any;
}
