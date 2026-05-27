import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('diagnoses')
export class Diagnosis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  incidentId: string;

  @Column('jsonb')
  evidence: any;

  @Column('jsonb')
  llmResponse: any;

  @Column()
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';

  @CreateDateColumn()
  generatedAt: Date;

  @Column()
  modelUsed: string;

  @Column({ nullable: true })
  inputTokens: number;

  @Column({ nullable: true })
  outputTokens: number;
}
