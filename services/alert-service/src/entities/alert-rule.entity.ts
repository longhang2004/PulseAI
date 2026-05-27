import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @Column()
  name: string;

  @Column('jsonb')
  condition: {
    incidentType?: string; // e.g. ERROR_BURST, LATENCY_DEGRADATION, SILENCE
    minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    streamId?: string;
    anyIncident?: boolean;
  };

  @Column('jsonb')
  channels: {
    slack?: {
      webhookUrl: string;
    };
    email?: {
      to: string[];
    };
    webhook?: {
      url: string;
    };
  };

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
