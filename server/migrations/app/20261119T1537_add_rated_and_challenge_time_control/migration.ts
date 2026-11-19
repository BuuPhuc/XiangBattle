#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2c55642e1f5dedeb48d969db3539b22d6872573d97df625e02d11a7f1d1ba9f8/contract';
import startContract from '../../snapshots/2c55642e1f5dedeb48d969db3539b22d6872573d97df625e02d11a7f1d1ba9f8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fcce1ce316a90a8b4356f17ee196d727b9c6664fa0a0a69c9c532ad6e4d6e9b6/contract';
import endContract from '../../snapshots/fcce1ce316a90a8b4356f17ee196d727b9c6664fa0a0a69c9c532ad6e4d6e9b6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'challenge',
        column: col('timeControlId', 'text', {
          notNull: true,
          default: lit('10+0'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'game',
        column: col('rated', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
