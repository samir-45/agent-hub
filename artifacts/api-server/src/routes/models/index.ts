import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, modelsTable, conversations, messages } from "@workspace/db";
import {
  CreateModelBody,
  UpdateModelBody,
  GetModelParams,
  UpdateModelParams,
  DeleteModelParams,
  GetStatsResponse,
  ListModelsResponse,
  CreateModelResponse,
  GetModelResponse,
  UpdateModelResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /stats
router.get("/stats", async (req, res): Promise<void> => {
  const [modelCounts] = await db
    .select({
      totalModels: sql<number>`count(*)::int`,
      enabledModels: sql<number>`count(*) filter (where ${modelsTable.enabled})::int`,
    })
    .from(modelsTable);

  const [convCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(conversations);

  const [msgCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(messages);

  const stats = {
    totalModels: modelCounts?.totalModels ?? 0,
    enabledModels: modelCounts?.enabledModels ?? 0,
    totalConversations: convCount?.total ?? 0,
    totalMessages: msgCount?.total ?? 0,
  };

  res.json(GetStatsResponse.parse(stats));
});

// GET /models
router.get("/models", async (_req, res): Promise<void> => {
  const models = await db.select().from(modelsTable).orderBy(modelsTable.createdAt);
  res.json(ListModelsResponse.parse(models));
});

// POST /models
router.post("/models", async (req, res): Promise<void> => {
  const parsed = CreateModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [model] = await db.insert(modelsTable).values({
    name: parsed.data.name,
    modelId: parsed.data.modelId,
    description: parsed.data.description ?? null,
    temperature: parsed.data.temperature ?? 0.7,
    maxTokens: parsed.data.maxTokens ?? 8192,
    systemPrompt: parsed.data.systemPrompt ?? null,
    topP: parsed.data.topP ?? 1.0,
    enabled: parsed.data.enabled ?? true,
  }).returning();
  res.status(201).json(CreateModelResponse.parse(model));
});

// GET /models/:id
router.get("/models/:id", async (req, res): Promise<void> => {
  const params = GetModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.id, params.data.id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json(GetModelResponse.parse(model));
});

// PATCH /models/:id
router.patch("/models/:id", async (req, res): Promise<void> => {
  const params = UpdateModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateModelBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.modelId !== undefined) updateData.modelId = parsed.data.modelId;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.temperature !== undefined) updateData.temperature = parsed.data.temperature;
  if (parsed.data.maxTokens !== undefined) updateData.maxTokens = parsed.data.maxTokens;
  if (parsed.data.systemPrompt !== undefined) updateData.systemPrompt = parsed.data.systemPrompt;
  if (parsed.data.topP !== undefined) updateData.topP = parsed.data.topP;
  if (parsed.data.enabled !== undefined) updateData.enabled = parsed.data.enabled;

  const [model] = await db
    .update(modelsTable)
    .set(updateData)
    .where(eq(modelsTable.id, params.data.id))
    .returning();
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json(UpdateModelResponse.parse(model));
});

// DELETE /models/:id
router.delete("/models/:id", async (req, res): Promise<void> => {
  const params = DeleteModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [model] = await db.delete(modelsTable).where(eq(modelsTable.id, params.data.id)).returning();
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
