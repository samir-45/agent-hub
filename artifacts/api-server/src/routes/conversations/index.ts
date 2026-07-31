import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, modelsTable, conversations, messages } from "@workspace/db";
import { getOpenRouterClient } from "../../lib/openrouter-client";
import { tavilySearch } from "../../lib/tavily";
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
  res.flushHeaders?.();

  // Signal: context loaded, about to call the model
  res.write(`data: ${JSON.stringify({ stage: "preparing" })}\n\n`);

  let fullResponse = "";

  /** Stream one OpenRouter SSE stream, emitting reasoning + content events. */
  async function pipeStream(stream: AsyncIterable<any>) {
    let generatingSignalSent = false;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta as any;

      // Reasoning tokens (deepseek-r1 and other thinking models)
      if (delta?.reasoning) {
        if (!generatingSignalSent) {
          res.write(`data: ${JSON.stringify({ stage: "generating" })}\n\n`);
          generatingSignalSent = true;
        }
        res.write(`data: ${JSON.stringify({ reasoning: delta.reasoning })}\n\n`);
      }

      // Regular content tokens
      if (delta?.content) {
        if (!generatingSignalSent) {
          res.write(`data: ${JSON.stringify({ stage: "generating" })}\n\n`);
          generatingSignalSent = true;
        }
        fullResponse += delta.content;
        res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
      }
    }
  }

  const userEmail = (req as any).auth?.claims?.email || (req as any).auth?.sessionClaims?.email;
  const userRole = (req as any).auth?.claims?.publicMetadata?.role || (req as any).auth?.sessionClaims?.publicMetadata?.role;
  const userHeaderKey = req.headers["x-openrouter-key"] as string | undefined;

  try {
    const openrouter = await getOpenRouterClient(userEmail, userHeaderKey, userRole);

    if (model.webSearchEnabled) {
      // ── Pre-search: fetch web results and inject as context ────────────────
      const userQuery = parsed.data.content;
      res.write(`data: ${JSON.stringify({ stage: "searching", query: userQuery })}\n\n`);

      let searchContext = "";
      try {
        searchContext = await tavilySearch(userQuery);
        req.log.info({ query: userQuery }, "Tavily search succeeded");
      } catch (searchErr) {
        req.log.warn({ searchErr }, "Tavily search failed — continuing without web results");
      }

      const messagesWithSearch: { role: "system" | "user" | "assistant"; content: string }[] = [];

      if (model.systemPrompt) {
        messagesWithSearch.push({ role: "system", content: model.systemPrompt });
      }

      if (searchContext) {
        messagesWithSearch.push({
          role: "system",
          content: [
            "## REAL-TIME WEB SEARCH RESULTS",
            "",
            "You have been connected to a live web search tool (Tavily). The search was executed RIGHT NOW for the user's latest message and returned the following real, current data:",
            "",
            searchContext,
            "",
            "## INSTRUCTIONS",
            "- You MUST use the above search results to answer the user.",
            "- Do NOT say you cannot browse the web or access the internet — you just did.",
            "- Do NOT say you lack real-time data — the data above IS real-time.",
            "- Cite sources (URLs) from the search results where relevant.",
            "- If the search results are insufficient, say so and summarize what you found.",
          ].join("\n"),
        });
      }

      for (const m of history) {
        messagesWithSearch.push({ role: m.role as "user" | "assistant", content: m.content });
      }

      const stream = await openrouter.chat.completions.create({
        model: model.modelId,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        top_p: model.topP,
        messages: messagesWithSearch,
        stream: true,
      });

      await pipeStream(stream);
    } else {
      // ── Standard streaming (no web search) ──────────────────────────────────
      const stream = await openrouter.chat.completions.create({
        model: model.modelId,
        max_tokens: model.maxTokens,
        temperature: model.temperature,
        top_p: model.topP,
        messages: chatMessages,
        stream: true,
      });

      await pipeStream(stream);
    }

    // Persist assistant message
    await db.insert(messages).values({
      conversationId: conv.id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    const errorMessage = err?.message || "Streaming failed";
    req.log.error({ err, errorMessage }, "OpenRouter streaming error");

    // Check if model is offline/unavailable or returning 404 on OpenRouter and attempt auto-fallback
    if (
      errorMessage.includes("404") ||
      errorMessage.includes("No endpoints found") ||
      errorMessage.includes("unavailable") ||
      errorMessage.includes("paid version")
    ) {
      req.log.info("Model endpoint offline/unavailable on OpenRouter. Retrying with active fallback model (meta-llama/llama-3.3-70b-instruct:free)...");
      try {
        res.write(`data: ${JSON.stringify({ content: `> *Notice: ${model.name} is currently offline on OpenRouter. Auto-switching to active free model (Meta Llama 3.3 70B)*\n\n` })}\n\n`);
        const openrouter = await getOpenRouterClient(userEmail, userHeaderKey, userRole);
        const fallbackStream = await openrouter.chat.completions.create({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          max_tokens: model.maxTokens,
          temperature: model.temperature,
          top_p: model.topP,
          messages: chatMessages,
          stream: true,
        });

        await pipeStream(fallbackStream);

        await db.insert(messages).values({
          conversationId: conv.id,
          role: "assistant",
          content: fullResponse,
        });

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      } catch (fallbackErr: any) {
        req.log.error({ fallbackErr }, "Fallback streaming also failed");
      }
    }

    res.write(`data: ${JSON.stringify({ error: errorMessage, done: true })}\n\n`);
  }

  res.end();
});

export default router;
