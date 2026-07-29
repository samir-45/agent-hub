import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, modelsTable, conversations, messages } from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import {
  ListModelConversationsParams,
  ListModelConversationsResponse,
  CreateModelConversationParams,
  CreateModelConversationBody,
  CreateModelConversationResponse,
  GetModelConversationParams,
  GetModelConversationResponse,
  DeleteModelConversationParams,
  ListModelMessagesParams,
  ListModelMessagesResponse,
  SendModelMessageParams,
  SendModelMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// GET /models/:modelId/conversations
router.get("/models/:modelId/conversations", async (req, res): Promise<void> => {
  const params = ListModelConversationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.modelId, params.data.modelId))
    .orderBy(conversations.createdAt);
  res.json(ListModelConversationsResponse.parse(convs));
});

// POST /models/:modelId/conversations
router.post("/models/:modelId/conversations", async (req, res): Promise<void> => {
  const params = CreateModelConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateModelConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.id, params.data.modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  const [conv] = await db
    .insert(conversations)
    .values({ modelId: params.data.modelId, title: parsed.data.title })
    .returning();
  res.status(201).json(CreateModelConversationResponse.parse(conv));
});

// GET /models/:modelId/conversations/:id
router.get("/models/:modelId/conversations/:id", async (req, res): Promise<void> => {
  const params = GetModelConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.modelId, params.data.modelId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt);
  res.json(GetModelConversationResponse.parse({ ...conv, messages: msgs }));
});

// DELETE /models/:modelId/conversations/:id
router.delete("/models/:modelId/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteModelConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.modelId, params.data.modelId)))
    .returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

// GET /models/:modelId/conversations/:id/messages
router.get("/models/:modelId/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListModelMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(ListModelMessagesResponse.parse(msgs));
});

// POST /models/:modelId/conversations/:id/messages — SSE streaming
router.post("/models/:modelId/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendModelMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SendModelMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Load model config
  const [model] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.id, params.data.modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  // Load conversation
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.modelId, params.data.modelId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Persist user message
  const [userMsg] = await db
    .insert(messages)
    .values({ conversationId: conv.id, role: "user", content: parsed.data.content })
    .returning();

  // Build chat history for context
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt);

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (model.systemPrompt) {
    chatMessages.push({ role: "system", content: model.systemPrompt });
  }
  for (const m of history) {
    chatMessages.push({ role: m.role as "user" | "assistant", content: m.content });
  }

  // Stream response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await openrouter.chat.completions.create({
      model: model.modelId,
      max_tokens: model.maxTokens,
      temperature: model.temperature,
      top_p: model.topP,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Persist assistant message
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "OpenRouter streaming error");
    res.write(`data: ${JSON.stringify({ error: "Streaming failed", done: true })}\n\n`);
  }

  res.end();
});

export default router;
