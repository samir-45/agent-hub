import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useListModels } from "@workspace/api-client-react";
import {
  Sparkles,
  ArrowLeft,
  Play,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Maximize2,
  Globe,
  Code2,
  Bot,
  Layers,
  Search,
  ShieldCheck,
  Zap,
  Terminal,
  ExternalLink,
  RefreshCw,
  FileText,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface AgentDef {
  role: string;
  avatar: string;
  description: string;
  model: string;
  categoryTag?: "reasoning" | "coding" | "fast" | "general";
}

interface WorkflowPreset {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  category: "research" | "coding" | "content" | "audit";
  agents: AgentDef[];
  samplePrompts: string[];
}

const PRESETS: WorkflowPreset[] = [
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

function getAssignedModelName(categoryTag: string | undefined, userModels: any[] = []) {
  if (!userModels || userModels.length === 0) return "Cockpit Model";

  const normalized = userModels.map((m: any) => ({
    ...m,
    idStr: ((m.modelId || "") + " " + (m.name || "")).toLowerCase(),
  }));

  if (categoryTag === "coding") {
    const match = normalized.find((m) => /coder|code|qwen|claude|gpt-4|sonnet|deepseek|dev|ultra|nemotron/.test(m.idStr));
    if (match) return match.name;
  } else if (categoryTag === "reasoning") {
    const match = normalized.find((m) => /r1|reason|llama-3|o1|o3|deepseek|claude|architect|gpt-4|ultra|nemotron/.test(m.idStr));
    if (match) return match.name;
  } else if (categoryTag === "fast") {
    const match = normalized.find((m) => /flash|mini|turbo|instant|haiku|speed|fast|gemini|ling/.test(m.idStr));
    if (match) return match.name;
  }

  return userModels[0]?.name || "Cockpit Model";
}

function cleanHtmlForIframe(content: string): string {
  if (!content) return "";
  let clean = content.trim();
  clean = clean.replace(/^```[a-z]*\s*/gi, "").replace(/\s*```$/gi, "").trim();
  const htmlMatch = clean.match(/<!DOCTYPE html[\s\S]*<\/html>/i) || clean.match(/<html[\s\S]*<\/html>/i);
  if (htmlMatch) {
    return htmlMatch[0];
  }
  return clean;
}

interface TraceStep {
  id: string;
  stage: string;
  agent?: string;
  avatar?: string;
  status?: string;
  tool?: string;
  query?: string;
  output?: string;
  timestamp: string;
}

export default function AgentWorkflowsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { data: userModels = [] } = useListModels();

  const [selectedPreset, setSelectedPreset] = useState<WorkflowPreset>(PRESETS[0]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"trace" | "artifact" | "preview">("trace");

  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [artifactContent, setArtifactContent] = useState<string>("");
  const [artifactType, setArtifactType] = useState<string>("report");
  const [copied, setCopied] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceSteps]);

  // Update iframe preview whenever code artifact changes
  useEffect(() => {
    if (artifactType === "code" && artifactContent && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(artifactContent);
        doc.close();
      }
    }
  }, [artifactContent, artifactType, activeTab]);

  const handleRunWorkflow = async () => {
    if (!inputPrompt.trim() || isRunning) return;

    setIsRunning(true);
    setTraceSteps([]);
    setArtifactContent("");
    setActiveTab("trace");

    const addTrace = (step: Partial<TraceStep>) => {
      setTraceSteps((prev) => [
        ...prev,
        {
          id: `step_${Date.now()}_${Math.random()}`,
          stage: step.stage || "info",
          agent: step.agent,
          avatar: step.avatar,
          status: step.status,
          tool: step.tool,
          query: step.query,
          output: step.output,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);
    };

    addTrace({
      stage: "start",
      status: `Starting ${selectedPreset.title} execution pipeline...`,
    });

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const localKey = typeof window !== "undefined" ? localStorage.getItem("openrouter_user_api_key") : null;
      if (localKey) headers["x-openrouter-key"] = localKey;

      const userEmail = user?.primaryEmailAddress?.emailAddress || (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress;
      if (userEmail) headers["x-user-email"] = userEmail;

      const response = await fetch("/api/workflows/run", {
        method: "POST",
        headers,
        body: JSON.stringify({
          workflowId: selectedPreset.id,
          prompt: inputPrompt.trim(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Execution request failed with status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          let event: any = null;
          try {
            event = JSON.parse(trimmed.slice(6));
          } catch {
            continue;
          }

          if (event.stage === "error") {
            addTrace({
              stage: "error",
              status: `Execution Error: ${event.error}`,
            });
            toast({
              title: "Workflow Execution Error",
              description: event.error,
              variant: "destructive",
            });
            setIsRunning(false);
            return;
          }

          if (event.stage === "agent_start") {
            addTrace({
              stage: "agent_start",
              agent: event.agent,
              avatar: event.avatar,
              status: event.status,
            });
          } else if (event.stage === "tool_call") {
            addTrace({
              stage: "tool_call",
              tool: event.tool,
              query: event.query,
              status: `Executing tool request...`,
            });
          } else if (event.stage === "tool_result") {
            addTrace({
              stage: "tool_result",
              tool: event.tool,
              output: event.resultSnippet,
            });
          } else if (event.stage === "agent_complete") {
            addTrace({
              stage: "agent_complete",
              agent: event.agent,
              avatar: event.avatar,
              output: event.output,
            });
          } else if (event.stage === "report_delta" || event.stage === "code_delta") {
            setArtifactContent((prev) => prev + event.content);
          } else if (event.stage === "done") {
            const finalType = event.artifactType || "report";
            setArtifactType(finalType);
            if (event.artifactContent) {
              setArtifactContent(cleanHtmlForIframe(event.artifactContent));
            }
            addTrace({
              stage: "done",
              status: "Workflow execution completed successfully!",
            });
            if (finalType === "code") {
              setActiveTab("preview");
            } else {
              setActiveTab("artifact");
            }
            toast({
              title: "Workflow Completed",
              description: `${selectedPreset.title} finished generating final artifact.`,
            });
          }
        }
      }
    } catch (err: any) {
      addTrace({
        stage: "error",
        status: `Execution Error: ${err.message || "An error occurred during workflow execution."}`,
      });
      toast({
        title: "Workflow Failed",
        description: err.message || "Execution error",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopyCode = () => {
    if (!artifactContent) return;
    navigator.clipboard.writeText(artifactContent);
    setCopied(true);
    toast({ title: "Copied!", description: "Artifact code copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070a08] text-foreground flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 h-16 border-b border-border/40 bg-[#070a08]/90 backdrop-blur-xl px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted/60 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-md glow-primary">
              <Layers className="h-5 w-5 text-black stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">Agent Workflows</h1>
                <Badge className="gradient-primary text-black font-semibold text-[10px] border-0 px-2 py-0.5">
                  Pro Engine
                </Badge>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono">Multi-Agent Autonomous Team Orchestration</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/generate">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-xl border-border/60 hover:border-emerald-500/40 hover:bg-emerald-500/5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Image Studio
            </Button>
          </Link>
          <UserButton />
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Cockpit Models Active Banner */}
        {userModels.length === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-4 text-amber-300 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
              <span>No active models found in your Cockpit. Please add your models via <strong>Add Model</strong> to power Agent Workflows.</span>
            </div>
            <Link href="/models/new">
              <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs rounded-xl h-8">
                + Add Model
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-4 text-emerald-300 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Dynamic Routing Engine Active: Orchestrating across <strong>{userModels.length} Cockpit Model{userModels.length !== 1 ? 's' : ''}</strong></span>
            </div>
            <Link href="/models/new">
              <Button size="sm" variant="ghost" className="text-emerald-400 hover:text-emerald-300 text-[11px] h-7 px-2">
                Manage Models →
              </Button>
            </Link>
          </div>
        )}

        {/* Preset Selector Header */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-emerald-400" /> Select Workflow Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">
            Choose a multi-agent team preset or enter a custom prompt to orchestrate autonomous tools & agents.
          </p>
        </div>

        {/* Workflow Preset Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRESETS.map((preset) => (
            <Card
              key={preset.id}
              onClick={() => setSelectedPreset(preset)}
              className={`cursor-pointer transition-all duration-300 rounded-2xl border ${
                selectedPreset.id === preset.id
                  ? "bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5 glow-primary"
                  : "bg-card/60 border-border/40 hover:border-emerald-500/20 hover:bg-card/90"
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{preset.icon}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground border-border/50">
                    {preset.agents.length} Agents
                  </Badge>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">{preset.title}</h3>
                  <p className="text-[11px] text-emerald-400 font-mono mt-0.5 line-clamp-1">{preset.subtitle}</p>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  {preset.agents.map((ag, i) => (
                    <span key={i} className="text-xs bg-muted/70 px-1.5 py-0.5 rounded-lg text-muted-foreground" title={`${ag.role} (${getAssignedModelName(ag.categoryTag, userModels)})`}>
                      {ag.avatar}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Input & Runner Section */}
        <Card className="bg-card/60 border-border/40 rounded-2xl shadow-xl backdrop-blur-xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{selectedPreset.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedPreset.title}</h3>
                  <p className="text-xs text-emerald-400 font-mono">{selectedPreset.subtitle}</p>
                </div>
              </div>

              {/* Active Agent Team & Assigned AI Models */}
              <div className="flex flex-wrap gap-2 items-center">
                {selectedPreset.agents.map((agent, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-muted/60 border border-border/50 px-2.5 py-1 rounded-xl text-xs">
                    <span>{agent.avatar}</span>
                    <span className="font-semibold text-foreground">{agent.role}:</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/5 px-1.5 py-0">
                      {getAssignedModelName(agent.categoryTag, userModels)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Describe your goal for the ${selectedPreset.title}... (e.g. "${selectedPreset.samplePrompts[0]}")`}
              className="resize-y min-h-[90px] max-h-[500px] bg-muted/40 border-border/50 focus-visible:ring-emerald-500/40 rounded-xl text-sm leading-relaxed"
              rows={3}
            />



            <div className="flex justify-end pt-1">
              <Button
                onClick={handleRunWorkflow}
                disabled={isRunning || !inputPrompt.trim()}
                className="gradient-primary text-black font-bold rounded-xl px-6 h-10 gap-2 shadow-lg glow-primary hover:opacity-95 transition-all"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" /> Running Workflow...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-black text-black" /> Execute Agentic Pipeline
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Execution Output Console & Artifact Tabs */}
        {(traceSteps.length > 0 || artifactContent) && (
          <Card className="bg-card/60 border-border/40 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
            <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
              <div className="px-5 pt-4 flex items-center justify-between border-b border-border/40 pb-3">
                <TabsList className="bg-muted/60 p-1 rounded-xl border border-border/40">
                  <TabsTrigger value="trace" className="text-xs px-3 h-7 rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Agent Trace ({traceSteps.length})
                  </TabsTrigger>
                  <TabsTrigger value="artifact" className="text-xs px-3 h-7 rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Report / Content
                  </TabsTrigger>
                  {artifactType === "code" && (
                    <TabsTrigger value="preview" className="text-xs px-3 h-7 rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Live Sandbox Preview
                    </TabsTrigger>
                  )}
                </TabsList>

                {artifactContent && (
                  <Button variant="outline" size="sm" onClick={handleCopyCode} className="h-7 text-xs gap-1.5 rounded-lg border-border/50 hover:bg-muted/60">
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy Output"}
                  </Button>
                )}
              </div>

              {/* Tab 1: Live Agent Trace Visualizer */}
              <TabsContent value="trace" className="p-5 mt-0 min-h-[300px] max-h-[550px] overflow-y-auto space-y-4 font-mono text-xs">
                {traceSteps.map((step) => (
                  <div key={step.id} className="flex gap-3 items-start animate-slide-up border-l-2 border-emerald-500/30 pl-3 py-1">
                    <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5">{step.timestamp}</span>
                    <div className="flex-1 space-y-1">
                      {step.agent && (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                          <span>{step.avatar || "🤖"}</span>
                          <span>{step.agent}</span>
                        </div>
                      )}
                      {step.tool && (
                        <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
                          <Globe className="h-3.5 w-3.5 animate-pulse" />
                          <span>Tool: {step.tool}</span>
                          {step.query && <span className="text-muted-foreground italic">({step.query})</span>}
                        </div>
                      )}
                      {step.status && <p className="text-muted-foreground">{step.status}</p>}
                      {step.output && (
                        <div className="bg-muted/40 p-2.5 rounded-xl border border-border/40 text-foreground font-sans text-xs leading-relaxed whitespace-pre-wrap">
                          {step.output}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={traceEndRef} />
              </TabsContent>

              {/* Tab 2: Formatted Report / Markdown Artifact */}
              <TabsContent value="artifact" className="p-6 mt-0 min-h-[350px] max-h-[600px] overflow-y-auto">
                {artifactContent ? (
                  <MarkdownRenderer content={artifactContent} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs space-y-2">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                    <p>Generating workflow artifact...</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Interactive HTML / React Code Sandbox Preview */}
              {artifactType === "code" && (
                <TabsContent value="preview" className="p-4 mt-0 min-h-[450px]">
                  <div className="w-full h-[600px] rounded-xl overflow-hidden border border-border/40 bg-slate-950 shadow-inner">
                    {artifactContent ? (
                      <iframe
                        ref={iframeRef}
                        srcDoc={cleanHtmlForIframe(artifactContent)}
                        title="Workflow App Preview"
                        className="w-full h-full border-0 bg-slate-950"
                        sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                        <p>Compiling live app preview...</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </Card>
        )}
      </main>
    </div>
  );
}
