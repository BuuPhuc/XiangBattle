#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4da9575af436d27c463ec33df6eae4417656c58f99e972a07a80cf7aebd04198/contract';
import startContract from '../../snapshots/4da9575af436d27c463ec33df6eae4417656c58f99e972a07a80cf7aebd04198/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8f446ab2907a0dcefcfe701a9e20ede3cf5bc71f29875e34a70e1c05a0134cf4/contract';
import endContract from '../../snapshots/8f446ab2907a0dcefcfe701a9e20ede3cf5bc71f29875e34a70e1c05a0134cf4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'academyProgress',
        columns: [
          col('challengeId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('completedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('courseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lessonId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'academyProgress',
        constraint: 'academyProgress_userId_challengeId_key',
        columns: ['userId', 'challengeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'academyProgress',
        index: 'academyProgress_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'academyProgress',
        foreignKey: {
          name: 'academyProgress_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
