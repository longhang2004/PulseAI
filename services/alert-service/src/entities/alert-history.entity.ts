import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('alert_history')
export class AlertHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @Column('uuid')
  ruleId: string;

  @Column('uuid')
  incidentId: string;

  @Column()
  channel: 'slack' | 'email' | 'webhook';

  @Column()
  status: 'success' | 'failed';

  @CreateDateColumn()
  sentAt: Date;

  @Column({ nullable: true })
  error: string;
}
