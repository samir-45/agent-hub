import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// Load .env from workspace root
const candidatePaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
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

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
