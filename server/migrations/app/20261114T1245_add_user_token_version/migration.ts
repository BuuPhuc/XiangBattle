#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/13bd352650c4905369076e67db3df74e5649876988e8e69a80fdb5d6d1ea7469/contract';
import endContract from '../../snapshots/13bd352650c4905369076e67db3df74e5649876988e8e69a80fdb5d6d1ea7469/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8f446ab2907a0dcefcfe701a9e20ede3cf5bc71f29875e34a70e1c05a0134cf4/contract';
import startContract from '../../snapshots/8f446ab2907a0dcefcfe701a9e20ede3cf5bc71f29875e34a70e1c05a0134cf4/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('tokenVersion', 'int4', {
          notNull: true,
          default: lit(0),
          codecRef: { codecId: 'pg/int4@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
