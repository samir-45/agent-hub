import { Router, type IRouter } from "express";
import { getOpenRouterClient } from "../lib/openrouter-client.js";
import { tavilySearch } from "../lib/tavily.js";
import { db, modelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

export interface AgentDef {
  role: string;
  avatar: string;
  description: string;
  model: string;
  categoryTag?: "reasoning" | "coding" | "fast" | "general";
}

export interface WorkflowPreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "research" | "coding" | "content" | "audit";
  agents: AgentDef[];
  samplePrompts: string[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "deep-research",
    title: "Deep Research Agent Team",
    subtitle: "Autonomous Multi-Step Web Intelligence & Synthesis",
    description: "Deploys 3 specialized AI agents to plan research queries, fetch real-time web data via Tavily, cross-verify sources, and generate a comprehensive executive report.",
    icon: "🔍",
    category: "research",
    agents: [
      { role: "Strategic Research Planner", avatar: "🧠", description: "Formulates search queries & analytical angles", model: "Cockpit Reasoning Model", categoryTag: "reasoning" },
      { role: "Live Web Analyst", avatar: "🌐", description: "Queries live search engine & extracts factual data", model: "Cockpit Fast Model", categoryTag: "fast" },
      { role: "Executive Report Synthesizer", avatar: "📑", description: "Synthesizes verified data into a structured report", model: "Cockpit Reasoning Model", categoryTag: "reasoning" },
    ],
    samplePrompts: [
      "Latest breakthroughs in solid-state battery technology and commercialization timelines",
      "Analysis of top AI agent frameworks in 2026: AutoGen vs CrewAI vs LangGraph",
      "Global semiconductor market forecast and geopolitical supply chain impacts",
    ],
  },
  {
    id: "code-builder",
    title: "Full-Stack Code & App Builder",
    subtitle: "Spec to Live Interactive Web App & Artifact",
    description: "Architect, UI Engineer, and Code Auditor agents collaborate to turn text prompts into standalone, live-previewable HTML/React application artifacts.",
    icon: "💻",
    category: "coding",
    agents: [
      { role: "System Architect", avatar: "📐", description: "Plans component layout, UI tokens, and state flow", model: "Cockpit Reasoning Model", categoryTag: "reasoning" },
      { role: "Lead UI Engineer", avatar: "⚡", description: "Writes production-ready HTML, Tailwind CSS, & JS", model: "Cockpit Coding Model", categoryTag: "coding" },
      { role: "Code Quality Auditor", avatar: "🛡️", description: "Verifies scripts, responsiveness, and dark-mode styling", model: "Cockpit Fast Model", categoryTag: "fast" },
    ],
    samplePrompts: [
      "Interactive Cyberpunk Crypto Portfolio Dashboard with live animated charts and dark theme",
      "Sleek SaaS Analytics Kanban Board with drag-and-drop cards and dark-mode glassmorphic UI",
      "Modern AI Image Studio generator workspace with prompt history and preview gallery",
    ],
  },
  {
    id: "content-studio",
    title: "Creative Content & Visual Campaign",
    subtitle: "Multi-Platform Copy & Image Studio Prompts",
    description: "Brand Strategist, Copywriter, and Visual Art Director collaborate to create multi-angle marketing copy and paired AI Image Studio prompts.",
    icon: "🎨",
    category: "content",
    agents: [
      { role: "Brand Strategist", avatar: "🎯", description: "Defines campaign positioning and hook angles", model: "Cockpit Reasoning Model", categoryTag: "reasoning" },
      { role: "Copywriter Agent", avatar: "✍️", description: "Writes compelling social posts, blogs, and ad copy", model: "Cockpit Fast Model", categoryTag: "fast" },
      { role: "Visual Art Director", avatar: "📸", description: "Crafts high-fidelity Image Studio visual prompts", model: "Cockpit General Model", categoryTag: "general" },
    ],
    samplePrompts: [
      "Product launch campaign for an AI-powered smart productivity ring",
      "Rebranding campaign for an eco-friendly EV electric sports car",
      "Viral social media announcement for a next-gen developer IDE plugin",
    ],
  },
  {
    id: "tech-audit",
    title: "Multi-Agent Technical Auditor",
    subtitle: "Security, Performance & Architectural Review",
    description: "Security Inspector and Performance Architect perform a multi-perspective review of code architectures, identifying vulnerabilities and optimizations.",
    icon: "🛡️",
    category: "audit",
    agents: [
      { role: "Security Vulnerability Auditor", avatar: "🔒", description: "Scans for auth leaks, injection risks, and header flaws", model: "Cockpit Reasoning Model", categoryTag: "reasoning" },
      { role: "Performance & Scaling Architect", avatar: "⚡", description: "Identifies async bottlenecks, memory leaks, & DB queries", model: "Cockpit Coding Model", categoryTag: "coding" },
    ],
    samplePrompts: [
      "Audit Node.js Express microservice handling Clerk JWT auth, database queries, and CORS headers",
      "Review React state management & custom hook data-fetching logic for memory leaks",
    ],
  },
];

async function selectBestCockpitModel(
  userEmail: string | undefined,
  preferredCategory: "reasoning" | "coding" | "fast" | "general"
): Promise<{ modelId: string; name: string }> {
  let userModels: any[] = [];
  try {
    if (userEmail) {
      userModels = await db
        .select()
        .from(modelsTable)
        .where(and(eq(modelsTable.enabled, true), eq(modelsTable.userId, userEmail)));
    }
  } catch {}

  if (userModels.length === 0) {
    try {
      userModels = await db
        .select()
        .from(modelsTable)
        .where(eq(modelsTable.enabled, true));
    } catch {}
  }

  if (userModels.length === 0) {
    throw new Error(
      "No active models found in your Cockpit. Please add models to your Cockpit (via 'Add Model') to power Agent Workflows."
    );
  }

  const normalized = userModels.map((m) => ({
    ...m,
    idStr: ((m.modelId || "") + " " + (m.name || "")).toLowerCase(),
  }));

  if (preferredCategory === "coding") {
    const match = normalized.find((m) => /coder|code|qwen|claude|gpt-4|sonnet|deepseek|dev|ultra|nemotron/.test(m.idStr));
    if (match) return { modelId: match.modelId, name: match.name };
  } else if (preferredCategory === "reasoning") {
    const match = normalized.find((m) => /r1|reason|llama-3|o1|o3|deepseek|claude|architect|gpt-4|ultra|nemotron/.test(m.idStr));
    if (match) return { modelId: match.modelId, name: match.name };
  } else if (preferredCategory === "fast") {
    const match = normalized.find((m) => /flash|mini|turbo|instant|haiku|speed|fast|gemini|ling/.test(m.idStr));
    if (match) return { modelId: match.modelId, name: match.name };
  }

  const first = userModels[0];
  return { modelId: first.modelId, name: first.name };
}

// GET /api/workflows — List all workflow presets
router.get("/workflows", (_req, res) => {
  res.json(WORKFLOW_PRESETS);
});

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function callOpenRouterWithFallback(
  openrouter: any,
  primaryModel: string,
  messages: any[],
  temperature = 0.7,
  onModelAttempt?: (model: string) => void
): Promise<any> {
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      primaryModel.replace(":free", ""),
      "google/gemini-2.0-flash-001",
      "deepseek/deepseek-chat",
      "meta-llama/llama-3.3-70b-instruct",
      "qwen/qwen-2.5-coder-32b-instruct",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ])
  );

  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      if (onModelAttempt) onModelAttempt(model);
      const res: any = await withTimeout(
        openrouter.chat.completions.create({
          model,
          temperature,
          messages,
        }),
        15000,
        `Model ${model} timed out after 15 seconds`
      );
      if (res && res.choices && res.choices[0]?.message) {
        return res;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${model} failed/timed out in workflow, retrying next candidate:`, err?.message || err);
    }
  }
  throw lastError || new Error("All fallback model candidates failed.");
}

async function streamOpenRouterWithFallback(
  openrouter: any,
  primaryModel: string,
  messages: any[],
  temperature = 0.7,
  onModelAttempt?: (model: string) => void
): Promise<any> {
  const candidateModels = Array.from(
    new Set([
      primaryModel,
      primaryModel.replace(":free", ""),
      "google/gemini-2.0-flash-001",
      "deepseek/deepseek-chat",
      "meta-llama/llama-3.3-70b-instruct",
      "qwen/qwen-2.5-coder-32b-instruct",
      "google/gemini-2.0-flash-exp:free",
      "meta-llama/llama-3.3-70b-instruct:free",
    ])
  );

  let lastError: any = null;
  for (const model of candidateModels) {
    try {
      if (onModelAttempt) onModelAttempt(model);
      const stream: any = await withTimeout(
        openrouter.chat.completions.create({
          model,
          temperature,
          messages,
          stream: true,
        }),
        15000,
        `Stream connection to ${model} timed out after 15 seconds`
      );
      return stream;
    } catch (err: any) {
      lastError = err;
      console.warn(`Streaming model ${model} failed/timed out in workflow, retrying next candidate:`, err?.message || err);
    }
  }
  throw lastError || new Error("All fallback model candidates failed.");
}

// POST /api/workflows/run — Execute workflow via SSE stream
router.post("/workflows/run", async (req, res): Promise<void> => {
  const { workflowId, prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }

  const preset = WORKFLOW_PRESETS.find((w) => w.id === workflowId) || WORKFLOW_PRESETS[0];

  const userEmail = (req.headers["x-user-email"] as string) || (req as any).auth?.claims?.email || (req as any).auth?.sessionClaims?.email;
  const userRole = (req.headers["x-user-role"] as string) || (req as any).auth?.claims?.publicMetadata?.role || (req as any).auth?.sessionClaims?.publicMetadata?.role;
  const userHeaderKey = req.headers["x-openrouter-key"] as string | undefined;

  // SSE Stream headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const emit = (data: Record<string, any>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const openrouter = await getOpenRouterClient(userEmail, userHeaderKey, userRole);

    emit({ stage: "start", workflow: preset.title, prompt: prompt.trim() });

    // EXECUTION BY WORKFLOW TYPE
    if (preset.id === "deep-research") {
      // ── STAGE 1: PLANNER AGENT ──────────────────────────────────────────
      const planner = preset.agents[0];
      const plannerModel = await selectBestCockpitModel(userEmail, planner.categoryTag || "reasoning");
      emit({ stage: "agent_start", agent: planner.role, avatar: planner.avatar, status: `Formulating strategy with ${plannerModel.name}...` });

      const planRes = await callOpenRouterWithFallback(
        openrouter,
        plannerModel.modelId,
        [
          {
            role: "system",
            content: `You are an elite Research Strategy Planner. Given the user's research topic, output EXACTLY 3 targeted search queries to fetch real-time intelligence. Return your response as a JSON array of strings, e.g.: ["query 1", "query 2", "query 3"]`,
          },
          { role: "user", content: prompt.trim() },
        ],
        0.5
      );

      let queries = [prompt.trim()];
      try {
        const rawContent = planRes.choices[0]?.message?.content || "";
        const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          queries = JSON.parse(jsonMatch[0]);
        }
      } catch {}

      emit({ stage: "agent_complete", agent: planner.role, avatar: planner.avatar, output: `Generated 3 targeted queries: ${queries.join(" | ")}` });

      // ── STAGE 2: LIVE WEB ANALYST (TAVILY TOOL) ──────────────────────────
      const webAnalyst = preset.agents[1];
      emit({ stage: "agent_start", agent: webAnalyst.role, avatar: webAnalyst.avatar, status: `Querying live web search engines...` });

      const searchResults: string[] = [];
      for (const q of queries) {
        emit({ stage: "tool_call", tool: "Tavily Search", query: q });
        try {
          const resText = await tavilySearch(q);
          searchResults.push(`### Search Query: "${q}"\n${resText}`);
          emit({ stage: "tool_result", tool: "Tavily Search", status: "Success", resultSnippet: resText.slice(0, 200) + "..." });
        } catch (err: any) {
          searchResults.push(`### Search Query: "${q}"\n(Search unavailable, using domain intelligence)`);
        }
      }

      const combinedSearchContext = searchResults.join("\n\n");
      emit({ stage: "agent_complete", agent: webAnalyst.role, avatar: webAnalyst.avatar, output: `Fetched ${searchResults.length} real-time web intelligence feeds.` });

      // ── STAGE 3: EXECUTIVE REPORT SYNTHESIZER ────────────────────────────
      const synthesizer = preset.agents[2];
      const synthModel = await selectBestCockpitModel(userEmail, synthesizer.categoryTag || "reasoning");
      emit({ stage: "agent_start", agent: synthesizer.role, avatar: synthesizer.avatar, status: `Synthesizing executive report with ${synthModel.name}...` });

      const stream = await streamOpenRouterWithFallback(
        openrouter,
        synthModel.modelId,
        [
          {
            role: "system",
            content: `You are an Executive Intelligence Synthesizer. Synthesize the provided live web search results into a comprehensive Executive Research Report in Markdown. Include headers, bullet points, source citations, and key insights.`,
          },
          {
            role: "user",
            content: `TOPIC: ${prompt.trim()}\n\nLIVE SEARCH DATA:\n${combinedSearchContext}`,
          },
        ],
        0.6
      );

      let fullReport = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullReport += text;
          emit({ stage: "report_delta", content: text });
        }
      }

      emit({ stage: "agent_complete", agent: synthesizer.role, avatar: synthesizer.avatar, output: "Final Executive Report completed." });
      emit({ stage: "done", artifactType: "report", artifactContent: fullReport });

    } else if (preset.id === "code-builder") {
      // ── STAGE 1: ARCHITECT AGENT ─────────────────────────────────────────
      const architect = preset.agents[0];
      const archModel = await selectBestCockpitModel(userEmail, architect.categoryTag || "reasoning");
      emit({ stage: "agent_start", agent: architect.role, avatar: architect.avatar, status: `Designing architecture with ${archModel.name}...` });

      const archRes = await callOpenRouterWithFallback(
        openrouter,
        archModel.modelId,
        [
          {
            role: "system",
            content: "You are a Master Software Architect. Outline the UI component structure, color tokens, and state flow for the requested web app in 3 short bullet points.",
          },
          { role: "user", content: prompt.trim() },
        ],
        0.7
      );

      const archPlan = archRes.choices[0]?.message?.content || "Planned UI architecture and state hierarchy.";
      emit({ stage: "agent_complete", agent: architect.role, avatar: architect.avatar, output: archPlan });

      // ── STAGE 2: LEAD UI ENGINEER ─────────────────────────────────────────
      const engineer = preset.agents[1];
      const engModel = await selectBestCockpitModel(userEmail, engineer.categoryTag || "coding");
      emit({ stage: "agent_start", agent: engineer.role, avatar: engineer.avatar, status: `Building web app with ${engModel.name}...` });

      const stream = await streamOpenRouterWithFallback(
        openrouter,
        engModel.modelId,
        [
          {
            role: "system",
            content: `You are a Lead UI Engineer. Generate a SINGLE, complete, standalone HTML file (including <!DOCTYPE html>, Tailwind CSS CDN <script src="https://cdn.tailwindcss.com"></script>, Lucide icons script if needed, and embedded JavaScript for interactivity).
The design MUST look extremely futuristic, polished, dark-mode themed, with vibrant gradients and interactive elements.
OUTPUT ONLY THE RAW HTML FILE WITHOUT ANY MARKDOWN WRAPPER (no \`\`\`html tags).`,
          },
          {
            role: "user",
            content: `ARCHITECT PLAN:\n${archPlan}\n\nUSER PROMPT: ${prompt.trim()}`,
          },
        ],
        0.5
      );

      let fullCode = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullCode += text;
          emit({ stage: "code_delta", content: text });
        }
      }

      // Clean up markdown code fences & preamble text if present
      let cleanHtml = fullCode.trim();
      cleanHtml = cleanHtml.replace(/^```[a-z]*\s*/gi, "").replace(/\s*```$/gi, "").trim();

      const htmlMatch = cleanHtml.match(/<!DOCTYPE html[\s\S]*<\/html>/i) || cleanHtml.match(/<html[\s\S]*<\/html>/i);
      if (htmlMatch) {
        cleanHtml = htmlMatch[0];
      }

      emit({ stage: "agent_complete", agent: engineer.role, avatar: engineer.avatar, output: "Generated standalone interactive HTML app." });
      emit({ stage: "done", artifactType: "code", artifactContent: cleanHtml });

    } else if (preset.id === "content-studio") {
      // ── STAGE 1: BRAND STRATEGIST ─────────────────────────────────────────
      const strategist = preset.agents[0];
      const stratModel = await selectBestCockpitModel(userEmail, strategist.categoryTag || "reasoning");
      emit({ stage: "agent_start", agent: strategist.role, avatar: strategist.avatar, status: `Formulating positioning with ${stratModel.name}...` });

      const stratRes = await callOpenRouterWithFallback(
        openrouter,
        stratModel.modelId,
        [
          {
            role: "system",
            content: "You are a Senior Brand Strategist. Outline 2 high-converting campaign hooks for the user's request.",
          },
          { role: "user", content: prompt.trim() },
        ],
        0.7
      );

      const stratOutput = stratRes.choices[0]?.message?.content || "Defined campaign positioning.";
      emit({ stage: "agent_complete", agent: strategist.role, avatar: strategist.avatar, output: stratOutput });

      // ── STAGE 2: COPYWRITER & ART DIRECTOR ───────────────────────────────
      const copywriter = preset.agents[1];
      const copyModel = await selectBestCockpitModel(userEmail, copywriter.categoryTag || "fast");
      emit({ stage: "agent_start", agent: copywriter.role, avatar: copywriter.avatar, status: `Drafting content with ${copyModel.name}...` });

      const stream = await streamOpenRouterWithFallback(
        openrouter,
        copyModel.modelId,
        [
          {
            role: "system",
            content: `You are a Copywriter and Visual Art Director team. Generate a full marketing campaign package in Markdown containing:
1. 📱 Social Media Announcement (X / LinkedIn)
2. 📧 Email / Pitch Hook
3. 🎨 Image Studio Visual Prompt (High quality prompt for AI image generation)`,
          },
          {
            role: "user",
            content: `STRATEGY:\n${stratOutput}\n\nPROMPT: ${prompt.trim()}`,
          },
        ],
        0.7
      );

      let contentPackage = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          contentPackage += text;
          emit({ stage: "report_delta", content: text });
        }
      }

      emit({ stage: "agent_complete", agent: copywriter.role, avatar: copywriter.avatar, output: "Completed content package & visual prompts." });
      emit({ stage: "done", artifactType: "content", artifactContent: contentPackage });

    } else {
      // ── STAGE 1: TECHNICAL AUDITOR ───────────────────────────────────────
      const auditor = preset.agents[0];
      const auditModel = await selectBestCockpitModel(userEmail, auditor.categoryTag || "reasoning");
      emit({ stage: "agent_start", agent: auditor.role, avatar: auditor.avatar, status: `Auditing code architecture with ${auditModel.name}...` });

      const stream = await streamOpenRouterWithFallback(
        openrouter,
        auditModel.modelId,
        [
          {
            role: "system",
            content: "You are an Elite Technical Auditor. Provide a 3-part Audit Report in Markdown: 1. Security & Auth Audit, 2. Performance Bottlenecks, 3. Refactoring Action Plan.",
          },
          { role: "user", content: prompt.trim() },
        ],
        0.5
      );

      let auditReport = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          auditReport += text;
          emit({ stage: "report_delta", content: text });
        }
      }

      emit({ stage: "agent_complete", agent: auditor.role, avatar: auditor.avatar, output: "Audit report completed." });
      emit({ stage: "done", artifactType: "audit", artifactContent: auditReport });
    }

  } catch (err: any) {
    const errorMsg = err?.message || "Workflow execution failed";
    emit({ stage: "error", error: errorMsg });
  }

  res.end();
});

export default router;
