import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __squawkPool: Pool | undefined;
}

export const pool =
  global.__squawkPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global.__squawkPool = pool;
}
