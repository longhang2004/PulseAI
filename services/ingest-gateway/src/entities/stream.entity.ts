import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('streams')
@Unique(['projectId', 'name'])
export class Stream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  projectId: string;

  @Column()
  @Index()
  name: string; // matches streamId

  @CreateDateColumn()
  firstSeenAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSignalAt: Date;

  @Column({ default: 0 })
  signalCount: number;
}
