#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d8647b6bb8078d9de8ea6687070f68af3563031ad2ca491b9e4a891eea742015/contract';
import endContract from '../../snapshots/d8647b6bb8078d9de8ea6687070f68af3563031ad2ca491b9e4a891eea742015/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'chatMessage',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('gameId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('playerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'emailVerificationToken',
        columns: [
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
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
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'friendship',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('requestedById', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('respondedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userHighId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userLowId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'friendship_status_check_f0e5c74c',
            "\"status\" IN ('PENDING', 'ACCEPTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'game',
        columns: [
          col('blackPlayerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('endReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('increment', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('initialTime', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('redPlayerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('result', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('roomCode', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PLAYING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('winnerPlayerId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'game_endReason_check_3f8443e8',
            "\"endReason\" IN ('CHECKMATE', 'RESIGN', 'TIMEOUT', 'DRAW_AGREEMENT', 'STALEMATE', 'REPETITION', 'CANCELLED', 'DISCONNECT')",
          ),
          checkExpression(
            'game_result_check_5986095b',
            "\"result\" IN ('RED_WIN', 'BLACK_WIN', 'DRAW')",
          ),
          checkExpression(
            'game_status_check_a37ae1cd',
            "\"status\" IN ('PLAYING', 'FINISHED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'move',
        columns: [
          col('capturedPiece', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('fromPosition', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('gameId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('moveNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notation', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('piece', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('playerId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('toPosition', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('arrowsEnabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bio', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('challengePermission', 'text', {
            notNull: true,
            default: lit('EVERYONE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('draws', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('emailVerified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('losses', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rating', 'int4', {
            notNull: true,
            default: lit(1200),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('recentGamesVisibility', 'text', {
            notNull: true,
            default: lit('PUBLIC'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('soundEnabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('wins', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'user_challengePermission_check_15bbea43',
            "\"challengePermission\" IN ('EVERYONE', 'FRIENDS', 'NOBODY')",
          ),
          checkExpression(
            'user_recentGamesVisibility_check_f08bd8b7',
            "\"recentGamesVisibility\" IN ('PUBLIC', 'FRIENDS', 'PRIVATE')",
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'emailVerificationToken',
        constraint: 'emailVerificationToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'friendship',
        constraint: 'friendship_userLowId_userHighId_key',
        columns: ['userLowId', 'userHighId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'game',
        constraint: 'game_roomCode_key',
        columns: ['roomCode'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_username_key',
        columns: ['username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_gameId_createdAt_idx_04c2aae6',
        columns: ['gameId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_gameId_idx_6cdb47f8',
        columns: ['gameId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emailVerificationToken',
        index: 'emailVerificationToken_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'friendship',
        index: 'friendship_requestedById_idx_f9a56c66',
        columns: ['requestedById'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'friendship',
        index: 'friendship_userHighId_idx_17b05671',
        columns: ['userHighId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'friendship',
        index: 'friendship_userLowId_idx_5401bbde',
        columns: ['userLowId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'game',
        index: 'game_blackPlayerId_idx_0d6ca423',
        columns: ['blackPlayerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'game',
        index: 'game_redPlayerId_idx_32ace704',
        columns: ['redPlayerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'game',
        index: 'game_winnerPlayerId_idx_662bf7dd',
        columns: ['winnerPlayerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'move',
        index: 'move_gameId_idx_6cdb47f8',
        columns: ['gameId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'move',
        index: 'move_gameId_moveNumber_idx_4e77f2e3',
        columns: ['gameId', 'moveNumber'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'move',
        index: 'move_playerId_idx_710cf1aa',
        columns: ['playerId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatMessage',
        foreignKey: {
          name: 'chatMessage_gameId_fkey',
          columns: ['gameId'],
          references: { schema: 'public', table: 'game', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatMessage',
        foreignKey: {
          name: 'chatMessage_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'emailVerificationToken',
        foreignKey: {
          name: 'emailVerificationToken_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'friendship',
        foreignKey: {
          name: 'friendship_userLowId_fkey',
          columns: ['userLowId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'friendship',
        foreignKey: {
          name: 'friendship_userHighId_fkey',
          columns: ['userHighId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'friendship',
        foreignKey: {
          name: 'friendship_requestedById_fkey',
          columns: ['requestedById'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'game',
        foreignKey: {
          name: 'game_redPlayerId_fkey',
          columns: ['redPlayerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'game',
        foreignKey: {
          name: 'game_blackPlayerId_fkey',
          columns: ['blackPlayerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'game',
        foreignKey: {
          name: 'game_winnerPlayerId_fkey',
          columns: ['winnerPlayerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'move',
        foreignKey: {
          name: 'move_gameId_fkey',
          columns: ['gameId'],
          references: { schema: 'public', table: 'game', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'move',
        foreignKey: {
          name: 'move_playerId_fkey',
          columns: ['playerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
