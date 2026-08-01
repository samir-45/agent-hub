import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

import path from "path";
import fs from "fs";

import { fileURLToPath } from "url";

if (!process.env.DATABASE_URL) {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env"),
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(envPath);
      } else {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match && !process.env[match[1]]) {
            process.env[match[1]] = (match[2] || "").replace(/^['"]|['"]$/g, "").trim();
          }
        }
      }
      break;
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
