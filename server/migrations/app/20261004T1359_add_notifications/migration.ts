#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9b5b82c28835effaa775c3841a6a06d660aef057007a92e205e195d426943e99/contract';
import endContract from '../../snapshots/9b5b82c28835effaa775c3841a6a06d660aef057007a92e205e195d426943e99/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d8647b6bb8078d9de8ea6687070f68af3563031ad2ca491b9e4a891eea742015/contract';
import startContract from '../../snapshots/d8647b6bb8078d9de8ea6687070f68af3563031ad2ca491b9e4a891eea742015/contract.json' with { type: 'json' };
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
        table: 'notification',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dedupeKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('read', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('relatedGameId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('relatedRequestId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('relatedUserId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'notification_type_check_33091c3c',
            "\"type\" IN ('FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'REMATCH_REQUEST', 'CHALLENGE', 'GAME_RESULT')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'notification',
        constraint: 'notification_dedupeKey_key',
        columns: ['dedupeKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_relatedUserId_idx_0e06ef1e',
        columns: ['relatedUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_userId_read_idx_76f3f2b6',
        columns: ['userId', 'read'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_relatedUserId_fkey',
          columns: ['relatedUserId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
