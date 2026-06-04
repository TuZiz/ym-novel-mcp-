import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "./migrations.js";

export class NovelDatabase {
  readonly db: Database.Database;
  readonly dbPath: string;

  constructor(inputPath: string) {
    this.dbPath = inputPath === ":memory:" ? inputPath : resolve(inputPath);

    if (this.dbPath !== ":memory:") {
      mkdirSync(dirname(this.dbPath), { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma("foreign_keys = ON");

    if (this.dbPath !== ":memory:") {
      this.db.pragma("journal_mode = WAL");
    }

    runMigrations(this.db);
  }

  close(): void {
    this.db.close();
  }
}
