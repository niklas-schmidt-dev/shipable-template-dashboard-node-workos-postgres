import { Pool } from "pg";

let pool: Pool | null = null;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function databasePool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Postgres queries.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    });
    pool.on("error", (error) => {
      console.error("Unexpected idle Postgres client error", error);
    });
  }
  return pool;
}

export async function query(sql: string, params: unknown[] = []) {
  const result = await databasePool().query(sql, params);
  return result.rows;
}
