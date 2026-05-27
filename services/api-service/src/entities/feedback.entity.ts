import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('diagnosis_feedbacks')
export class DiagnosisFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  diagnosisId: string;

  @Column()
  helpful: boolean;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
