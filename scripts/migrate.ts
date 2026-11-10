import { closeDb, dbPath, getDb } from "../src/db";

getDb();
closeDb();
console.log(`Database migrated at ${dbPath()}`);
