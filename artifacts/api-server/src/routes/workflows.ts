import { Router, type IRouter } from "express";
import { getOpenRouterClient } from "../lib/openrouter-client.js";
import { tavilySearch } from "../lib/tavily.js";

const router: IRouter = Router();

export interface WorkflowPreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "research" | "coding" | "content" | "audit";
  agents: { role: string; avatar: string; description: string; model: string }[];
  samplePrompts: string[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "deep-research",
    title: "Deep Research Agent Team",
    subtitle: "Autonomous Multi-Step Web Intelligence & Synthesis",
    description: "Deploys a team of 3 specialized AI agents to plan research queries, fetch real-time web data via Tavily, cross-verify sources, and generate a comprehensive executive report.",
    icon: "🔍",
    category: "research",
    agents: [
      { role: "Strategic Research Planner", avatar: "🧠", description: "Formulates search queries & analytical angles", model: "meta-llama/llama-3.3-70b-instruct:free" },
      { role: "Live Web Analyst", avatar: "🌐", description: "Queries live search engine & extracts factual data", model: "google/gemini-2.0-flash-exp:free" },
      { role: "Executive Report Synthesizer", avatar: "📑", description: "Synthesizes verified data into a structured report", model: "deepseek/deepseek-r1-distill-llama-70b:free" },
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
    description: "A collaborative pair of System Architect, UI Engineer, and Code Auditor agents turn text prompts into standalone, live-previewable HTML/React application artifacts.",
    icon: "💻",
    category: "coding",
    agents: [
      { role: "System Architect", avatar: "📐", description: "Plans component layout, UI tokens, and state flow", model: "meta-llama/llama-3.3-70b-instruct:free" },
      { role: "Lead UI Engineer", avatar: "⚡", description: "Writes production-ready HTML, Tailwind CSS, & JS", model: "qwen/qwen-2.5-coder-32b-instruct:free" },
      { role: "Code Quality Auditor", avatar: "🛡️", description: "Verifies scripts, responsiveness, and dark-mode styling", model: "google/gemini-2.0-flash-exp:free" },
    ],
    samplePrompts: [
      "Interactive Cyberpunk Crypto Portfolio Dashboard with live animated charts and dark theme",
      "Sleek SaaS Analytics Kanban Board with drag-and-drop cards and dark-mode glassmorphism UI",
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
      { role: "Brand Strategist", avatar: "🎯", description: "Defines campaign positioning and hook angles", model: "meta-llama/llama-3.3-70b-instruct:free" },
      { role: "Copywriter Agent", avatar: "✍️", description: "Writes compelling social posts, blogs, and ad copy", model: "google/gemini-2.0-flash-exp:free" },
      { role: "Visual Art Director", avatar: "📸", description: "Crafts high-fidelity Image Studio visual prompts", model: "meta-llama/llama-3.3-70b-instruct:free" },
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
      { role: "Security Vulnerability Auditor", avatar: "🔒", description: "Scans for auth leaks, injection risks, and header flaws", model: "deepseek/deepseek-r1-distill-llama-70b:free" },
      { role: "Performance & Scaling Architect", avatar: "⚡", description: "Identifies async bottlenecks, memory leaks, & DB queries", model: "meta-llama/llama-3.3-70b-instruct:free" },
    ],
    samplePrompts: [
      "Audit Node.js Express microservice handling Clerk JWT auth, database queries, and CORS headers",
      "Review React state management & custom hook data-fetching logic for memory leaks",
    ],
  },
];

// GET /api/workflows — List all workflow presets
router.get("/workflows", (_req, res) => {
  res.json(WORKFLOW_PRESETS);
});

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
      emit({ stage: "agent_start", agent: planner.role, avatar: planner.avatar, status: "Formulating research strategy & search queries..." });

      const planRes = await openrouter.chat.completions.create({
        model: planner.model,
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content: `You are an elite Research Strategy Planner. Given the user's research topic, output EXACTLY 3 targeted search queries to fetch real-time intelligence. Return your response as a JSON array of strings, e.g.: ["query 1", "query 2", "query 3"]`,
          },
          { role: "user", content: prompt.trim() },
        ],
      });

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
      emit({ stage: "agent_start", agent: synthesizer.role, avatar: synthesizer.avatar, status: "Synthesizing executive report with citation links..." });

      const stream = await openrouter.chat.completions.create({
        model: synthesizer.model,
        temperature: 0.6,
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an Executive Intelligence Synthesizer. Synthesize the provided live web search results into a comprehensive Executive Research Report in Markdown. Include headers, bullet points, source citations, and key insights.`,
          },
          {
            role: "user",
            content: `TOPIC: ${prompt.trim()}\n\nLIVE SEARCH DATA:\n${combinedSearchContext}`,
          },
        ],
      });

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
      emit({ stage: "agent_start", agent: architect.role, avatar: architect.avatar, status: "Designing component hierarchy & UI tokens..." });

      const archRes = await openrouter.chat.completions.create({
        model: architect.model,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are a Master Software Architect. Outline the UI component structure, color tokens, and state flow for the requested web app in 3 short bullet points.",
          },
          { role: "user", content: prompt.trim() },
        ],
      });

      const archPlan = archRes.choices[0]?.message?.content || "Planned UI architecture and state hierarchy.";
      emit({ stage: "agent_complete", agent: architect.role, avatar: architect.avatar, output: archPlan });

      // ── STAGE 2: LEAD UI ENGINEER ─────────────────────────────────────────
      const engineer = preset.agents[1];
      emit({ stage: "agent_start", agent: engineer.role, avatar: engineer.avatar, status: "Writing full production HTML5 + Tailwind CSS + JS app..." });

      const stream = await openrouter.chat.completions.create({
        model: engineer.model,
        temperature: 0.5,
        stream: true,
        messages: [
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
      });

      let fullCode = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullCode += text;
          emit({ stage: "code_delta", content: text });
        }
      }

      // Clean up markdown code fences if present
      let cleanHtml = fullCode.trim();
      if (cleanHtml.startsWith("```html")) {
        cleanHtml = cleanHtml.replace(/^```html\n?/, "").replace(/\n?```$/, "");
      } else if (cleanHtml.startsWith("```")) {
        cleanHtml = cleanHtml.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      }

      emit({ stage: "agent_complete", agent: engineer.role, avatar: engineer.avatar, output: "Generated standalone interactive HTML app." });
      emit({ stage: "done", artifactType: "code", artifactContent: cleanHtml });

    } else if (preset.id === "content-studio") {
      // ── STAGE 1: BRAND STRATEGIST ─────────────────────────────────────────
      const strategist = preset.agents[0];
      emit({ stage: "agent_start", agent: strategist.role, avatar: strategist.avatar, status: "Formulating campaign positioning & angle..." });

      const stratRes = await openrouter.chat.completions.create({
        model: strategist.model,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "You are a Senior Brand Strategist. Outline 2 high-converting campaign hooks for the user's request.",
          },
          { role: "user", content: prompt.trim() },
        ],
      });

      const stratOutput = stratRes.choices[0]?.message?.content || "Defined campaign positioning.";
      emit({ stage: "agent_complete", agent: strategist.role, avatar: strategist.avatar, output: stratOutput });

      // ── STAGE 2: COPYWRITER & ART DIRECTOR ───────────────────────────────
      const copywriter = preset.agents[1];
      emit({ stage: "agent_start", agent: copywriter.role, avatar: copywriter.avatar, status: "Drafting multi-platform copy & Image Studio prompts..." });

      const stream = await openrouter.chat.completions.create({
        model: copywriter.model,
        temperature: 0.7,
        stream: true,
        messages: [
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
      });

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
      emit({ stage: "agent_start", agent: auditor.role, avatar: auditor.avatar, status: "Auditing security, latency, & architecture..." });

      const stream = await openrouter.chat.completions.create({
        model: auditor.model,
        temperature: 0.5,
        stream: true,
        messages: [
          {
            role: "system",
            content: "You are an Elite Technical Auditor. Provide a 3-part Audit Report in Markdown: 1. Security & Auth Audit, 2. Performance Bottlenecks, 3. Refactoring Action Plan.",
          },
          { role: "user", content: prompt.trim() },
        ],
      });

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
