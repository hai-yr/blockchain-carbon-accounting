import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn
} from 'typeorm';

@Entity()
export class UploadedFile {

  @PrimaryGeneratedColumn("uuid")
  uuid!: string;

  @Column({nullable: false})
  name!: string;

  @Column({nullable: false})
  size!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

