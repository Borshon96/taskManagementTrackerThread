import { DatabaseSync, type StatementSync } from "node:sqlite";

type CompatStatement = StatementSync & {
  raw: (toggle?: boolean) => CompatStatement;
};

function wrapStatement(stmt: StatementSync): CompatStatement {
  let asRaw = false;
  const wrap = {
    ...stmt,
    raw(toggle = true) {
      asRaw = toggle;
      return wrap;
    },
    run(...params: never[]) {
      return stmt.run(...params);
    },
    get(...params: never[]) {
      const row = stmt.get(...params);
      if (row === undefined) return undefined;
      return asRaw ? Object.values(row as Record<string, unknown>) : row;
    },
    all(...params: never[]) {
      const rows = stmt.all(...params) as Record<string, unknown>[];
      return asRaw ? rows.map((row) => Object.values(row)) : rows;
    },
  } as CompatStatement;
  return wrap;
}

/** Minimal better-sqlite3-shaped wrapper around `node:sqlite` for Drizzle. */
export default class NodeSqliteDatabase {
  readonly memory: boolean;
  readonly readonly = false;
  readonly name: string;
  open = true;

  private readonly _db: DatabaseSync;
  private _depth = 0;

  constructor(filename: string) {
    const anonymous = filename === "" || filename === ":memory:";
    this.memory = anonymous;
    this.name = anonymous ? ":memory:" : filename;
    this._db = new DatabaseSync(filename);
  }

  get inTransaction() {
    return this._depth > 0;
  }

  pragma(source: string): unknown {
    this._db.exec(`PRAGMA ${source}`);
    return [];
  }

  prepare(sql: string): CompatStatement {
    return wrapStatement(this._db.prepare(sql));
  }

  exec(source: string): this {
    this._db.exec(source);
    return this;
  }

  close(): void {
    if (!this.open) return;
    this._db.close();
    this.open = false;
  }

  transaction<F extends (...args: never[]) => unknown>(fn: F): BetterSqlite3Transaction<F> {
    const self = this;
    const wrap = (begin: string): BetterSqlite3Transaction<F> => {
      const run = (...args: Parameters<F>): ReturnType<F> => {
        const nested = self.inTransaction;
        if (nested) {
          self.prepare("SAVEPOINT `__bs3`").run();
        } else {
          self._depth += 1;
          self.prepare(begin).run();
        }
        try {
          const result = fn(...args) as ReturnType<F>;
          if (result !== null && typeof result === "object" && "then" in result) {
            throw new TypeError("Transaction function cannot return a promise");
          }
          if (nested) {
            self.prepare("RELEASE `__bs3`").run();
          } else {
            self.prepare("COMMIT").run();
            self._depth -= 1;
          }
          return result;
        } catch (err) {
          if (nested) {
            self.prepare("ROLLBACK TO `__bs3`").run();
            self.prepare("RELEASE `__bs3`").run();
          } else {
            self.prepare("ROLLBACK").run();
            self._depth -= 1;
          }
          throw err;
        }
      };
      return run as BetterSqlite3Transaction<F>;
    };

    const deferred = wrap("BEGIN DEFERRED");
    deferred.default = deferred;
    deferred.deferred = wrap("BEGIN DEFERRED");
    deferred.immediate = wrap("BEGIN IMMEDIATE");
    deferred.exclusive = wrap("BEGIN EXCLUSIVE");
    return deferred;
  }
}

type BetterSqlite3Transaction<F extends (...args: never[]) => unknown> = ((
  ...args: Parameters<F>
) => ReturnType<F>) & {
  default: BetterSqlite3Transaction<F>;
  deferred: BetterSqlite3Transaction<F>;
  immediate: BetterSqlite3Transaction<F>;
  exclusive: BetterSqlite3Transaction<F>;
};
