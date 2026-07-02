import Database from 'better-sqlite3';
const db = new Database('database.sqlite');

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables);
  
  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table.name} LIMIT 10`).all();
    console.log(`\nTable ${table.name} rows:`, JSON.stringify(rows, null, 2).substring(0, 1500));
  }
} catch (err) {
  console.error(err);
}

