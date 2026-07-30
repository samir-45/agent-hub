/// <reference types="node" />
import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// Automatically load .env from workspace root if DATABASE_URL is not already set
if (!process.env.DATABASE_URL) {
  const rootEnvPath = path.resolve(currentDir, "../../.env");
  if (fs.existsSync(rootEnvPath)) {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(rootEnvPath);
    } else {
      const content = fs.readFileSync(rootEnvPath, "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = (match[2] || "").replace(/^['"]|['"]$/g, "").trim();
        }
      }
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in .env. Ensure the database is provisioned.");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
