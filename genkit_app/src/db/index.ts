import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dotenv from "dotenv";

import * as schema from "./schema";

dotenv.config();

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL not set");
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
