import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { encrypt, decrypt, maskApiKey } from "../lib/encryption";
import { invalidateApiKeyCache } from "../lib/openrouter-client";
import { z } from "zod";

const router: IRouter = Router();

const SETTING_KEY = "openrouter_api_key";

// GET /api/settings/openrouter-api-key
// Returns masked key (never the raw value)
router.get("/settings/openrouter-api-key", async (req, res): Promise<void> => {
  try {
    const userEmail = (req as any).auth?.claims?.email || (req as any).auth?.sessionClaims?.email;
    const userRole = (req as any).auth?.claims?.publicMetadata?.role || (req as any).auth?.sessionClaims?.publicMetadata?.role;
    const isAdmin = userEmail === "mdmahinkhan851@gmail.com" || userRole === "admin";

    const [row] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, SETTING_KEY));

    if (!row) {
      // ONLY reveal env var to Admin user!
      const hasEnvKey = isAdmin && Boolean(process.env.OPENROUTER_API_KEY);
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
  } catch (err: any) {
    const userEmail = (req as any).auth?.claims?.email || (req as any).auth?.sessionClaims?.email;
    const userRole = (req as any).auth?.claims?.publicMetadata?.role || (req as any).auth?.sessionClaims?.publicMetadata?.role;
    const isAdmin = userEmail === "mdmahinkhan851@gmail.com" || userRole === "admin";

    const hasEnvKey = isAdmin && Boolean(process.env.OPENROUTER_API_KEY);
    res.json({
      exists: hasEnvKey,
      source: hasEnvKey ? "env" : "none",
      maskedKey: hasEnvKey ? maskApiKey(process.env.OPENROUTER_API_KEY!) : null,
      dbError: err.message,
    });
  }
});

// Helper to check if request comes from admin
function isReqAdmin(req: any): boolean {
  const userEmail = (req.headers["x-user-email"] as string) || req.auth?.claims?.email || req.auth?.sessionClaims?.email;
  const userRole = (req.headers["x-user-role"] as string) || req.auth?.claims?.publicMetadata?.role || req.auth?.sessionClaims?.publicMetadata?.role;
  return userEmail === "mdmahinkhan851@gmail.com" || userRole === "admin";
}

const UpsertBody = z.object({ apiKey: z.string().min(1) });

// PUT /api/settings/openrouter-api-key
router.put("/settings/openrouter-api-key", async (req, res): Promise<void> => {
  try {
    if (!isReqAdmin(req)) {
      res.status(403).json({ error: "Only admins can update the system API key" });
      return;
    }

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
  } catch (err: any) {
    console.error("Failed to save API key to DB:", err);
    res.status(500).json({ error: err.message || "Failed to save API key to database" });
  }
});

// DELETE /api/settings/openrouter-api-key
router.delete("/settings/openrouter-api-key", async (req, res): Promise<void> => {
  try {
    if (!isReqAdmin(req)) {
      res.status(403).json({ error: "Only admins can delete the system API key" });
      return;
    }

    await db.delete(settingsTable).where(eq(settingsTable.key, SETTING_KEY));
    invalidateApiKeyCache();
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete API key from DB:", err);
    res.status(500).json({ error: err.message || "Failed to delete API key from database" });
  }
});

export default router;
