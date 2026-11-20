#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/dc300b3d80e1d80b6d7352bd9933dba2b07f78311ac8b59dba8c56c4b9950e40/contract';
import endContract from '../../snapshots/dc300b3d80e1d80b6d7352bd9933dba2b07f78311ac8b59dba8c56c4b9950e40/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fcce1ce316a90a8b4356f17ee196d727b9c6664fa0a0a69c9c532ad6e4d6e9b6/contract';
import startContract from '../../snapshots/fcce1ce316a90a8b4356f17ee196d727b9c6664fa0a0a69c9c532ad6e4d6e9b6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'game',
        column: col('blackRatingAfter', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'game',
        column: col('blackRatingBefore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'game',
        column: col('redRatingAfter', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'game',
        column: col('redRatingBefore', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
