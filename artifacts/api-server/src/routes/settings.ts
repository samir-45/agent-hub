import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { encrypt, decrypt, maskApiKey } from "../lib/encryption";
import { invalidateApiKeyCache } from "../lib/openrouter-client";
import { invalidateTavilyKeyCache } from "../lib/tavily";
import { z } from "zod";

const router: IRouter = Router();

const SETTING_KEY = "openrouter_api_key";

// GET /api/settings/openrouter-api-key
// Returns masked key (never the raw value)
router.get("/settings/openrouter-api-key", async (_req, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, SETTING_KEY));

  if (!row) {
    // Check if env var is set as fallback
    const hasEnvKey = Boolean(process.env.OPENROUTER_API_KEY);
    res.json({
      exists: hasEnvKey,
      source: hasEnvKey ? "env" : "none",
      maskedKey: hasEnvKey
        ? maskApiKey(process.env.OPENROUTER_API_KEY!)
        : null,
    });
    return;
  }

  const raw = decrypt(row.encryptedValue, row.iv, row.authTag);
  res.json({
    exists: true,
    source: "database",
    maskedKey: maskApiKey(raw),
  });
});

const UpsertBody = z.object({ apiKey: z.string().min(1) });

// PUT /api/settings/openrouter-api-key
router.put("/settings/openrouter-api-key", async (req, res): Promise<void> => {
  const parsed = UpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "apiKey is required" });
    return;
  }

  const { encryptedValue, iv, authTag } = encrypt(parsed.data.apiKey);

  await db
    .insert(settingsTable)
    .values({ key: SETTING_KEY, encryptedValue, iv, authTag })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { encryptedValue, iv, authTag, updatedAt: new Date() },
    });

  invalidateApiKeyCache();

  const masked = maskApiKey(parsed.data.apiKey);
  res.json({ success: true, maskedKey: masked });
});

// DELETE /api/settings/openrouter-api-key
router.delete("/settings/openrouter-api-key", async (_req, res): Promise<void> => {
  await db.delete(settingsTable).where(eq(settingsTable.key, SETTING_KEY));
  invalidateApiKeyCache();
  res.json({ success: true });
});

export default router;
