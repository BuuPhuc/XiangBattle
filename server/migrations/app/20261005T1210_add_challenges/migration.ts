#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4da9575af436d27c463ec33df6eae4417656c58f99e972a07a80cf7aebd04198/contract';
import endContract from '../../snapshots/4da9575af436d27c463ec33df6eae4417656c58f99e972a07a80cf7aebd04198/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9b5b82c28835effaa775c3841a6a06d660aef057007a92e205e195d426943e99/contract';
import startContract from '../../snapshots/9b5b82c28835effaa775c3841a6a06d660aef057007a92e205e195d426943e99/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'challenge',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('receiverId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('respondedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('senderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userHighId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userLowId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'challenge_status_check_3832c7d4',
            "\"status\" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'challenge',
        index: 'challenge_pending_pair_0a23c4e2',
        columns: ['userLowId', 'userHighId'],
        extras: { where: "(status = 'PENDING')", unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'challenge',
        index: 'challenge_receiverId_idx_fe124f44',
        columns: ['receiverId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'challenge',
        index: 'challenge_receiverId_status_idx_1f8f1a2b',
        columns: ['receiverId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'challenge',
        index: 'challenge_senderId_idx_4689c490',
        columns: ['senderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'challenge',
        index: 'challenge_senderId_status_idx_4d7d6199',
        columns: ['senderId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'challenge',
        foreignKey: {
          name: 'challenge_senderId_fkey',
          columns: ['senderId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'challenge',
        foreignKey: {
          name: 'challenge_receiverId_fkey',
          columns: ['receiverId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
