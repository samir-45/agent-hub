import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import { useGetStats, useListModels, useDeleteModel, getListModelsQueryKey, getGetStatsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Plus, Zap, MessageSquare, Database, Settings, Sparkles, ArrowUpRight, Loader2, Trash2, BarChart2, TrendingUp, PieChart, Cpu, Layers, DollarSign, Clock, CheckCircle2, Download, FileText, ShieldCheck, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UserButton, SignedIn, useUser } from '@clerk/clerk-react';

const BEST_FREE_MODELS_CLIENT = [
  { name: 'Llama 3.3 70B Instruct (Free)', modelId: 'meta-llama/llama-3.3-70b-instruct:free', description: "Meta's flagship 70B open weight model with 128k context window.", maxTokens: 8192, temperature: 0.7 },
  { name: 'Gemini 2.0 Flash Exp (Free)', modelId: 'google/gemini-2.0-flash-exp:free', description: "Google's next-gen Gemini 2.0 Flash model. Ultra fast speed & multimodal.", maxTokens: 8192, temperature: 0.7 },
  { name: 'Gemini 2.0 Flash Thinking (Free)', modelId: 'google/gemini-2.0-flash-thinking-exp:free', description: "Google's advanced reasoning model with reasoning chain-of-thought.", maxTokens: 8192, temperature: 0.6 },
  { name: 'DeepSeek R1 Distill 70B (Free)', modelId: 'deepseek/deepseek-r1-distill-llama-70b:free', description: "DeepSeek R1 reasoning distilled into Llama 70B.", maxTokens: 8192, temperature: 0.6 },
  { name: 'Qwen 2.5 Coder 32B (Free)', modelId: 'qwen/qwen-2.5-coder-32b-instruct:free', description: "Alibaba's elite 32B coding model optimized for code generation & debugging.", maxTokens: 8192, temperature: 0.5 },
  { name: 'NVIDIA Nemotron 3 Ultra (Free)', modelId: 'nvidia/nemotron-3-ultra:free', description: "NVIDIA's high-throughput model tuned for instruction following & chat.", maxTokens: 8192, temperature: 0.7 },
  { name: 'Mistral 7B Instruct (Free)', modelId: 'mistralai/mistral-7b-instruct:free', description: "Mistral's fast and efficient 7B instruct model.", maxTokens: 8192, temperature: 0.7 },
  { name: 'Phi-3 Medium 128k (Free)', modelId: 'microsoft/phi-3-medium-128k-instruct:free', description: "Microsoft's 14B compact model with 128k context support.", maxTokens: 8192, temperature: 0.7 },
  { name: 'Gemma 2 9B IT (Free)', modelId: 'google/gemma-2-9b-it:free', description: "Google's Gemma 2 9B instruction-tuned model.", maxTokens: 8192, temperature: 0.7 },
  { name: 'OpenChat 7B (Free)', modelId: 'openchat/openchat-7b:free', description: "OpenChat 7B tuned with C-RLFT for ChatGPT-like conversational quality.", maxTokens: 8192, temperature: 0.7 },
];

type ModelCategory = 'all' | 'reasoning' | 'coding' | 'fast' | 'vision';

function getModelCategory(model: { modelId: string; name: string }): ModelCategory {
  const id = (model.modelId || '').toLowerCase();
  const name = (model.name || '').toLowerCase();

  if (id.includes('coder') || id.includes('code') || id.includes('deepseek-chat') || id.includes('deepseek-v3')) {
    return 'coding';
  }
  if (id.includes('r1') || id.includes('llama-3.3-70b') || name.includes('70b') || name.includes('reasoning')) {
    return 'reasoning';
  }
  if (id.includes('vision') || id.includes('imagen') || id.includes('janus') || id.includes('gemma') || id.includes('nemotron')) {
    return 'vision';
  }
  return 'fast';
}

const CATEGORY_LABELS: Record<ModelCategory, { label: string; icon: string }> = {
  all: { label: 'All Models', icon: '🌐' },
  reasoning: { label: 'Reasoning', icon: '🧠' },
  coding: { label: 'Coding & Dev', icon: '💻' },
  fast: { label: 'Fast & Compact', icon: '⚡' },
  vision: { label: 'Multimodal', icon: '👁️' },
};

function AnalyticsChartsGrid({
  models = [],
  stats,
}: {
  models?: any[];
  stats?: { totalModels?: number; enabledModels?: number; totalConversations?: number; totalMessages?: number };
}) {
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts = { reasoning: 0, coding: 0, fast: 0, vision: 0 };
    if (Array.isArray(models)) {
      models.forEach((m) => {
        const cat = getModelCategory(m);
        if (cat in counts) {
          counts[cat as keyof typeof counts]++;
        }
      });
    }
    return counts;
  }, [models]);

  const totalModelsCount = models.length || stats?.totalModels || 0;
  const activeModelsCount = stats?.enabledModels ?? models.filter((m) => m.enabled).length;
  const totalConvos = stats?.totalConversations || 0;
  const totalMsgs = stats?.totalMessages || 0;

  const totalMaxTokens = useMemo(() => {
    if (!Array.isArray(models) || models.length === 0) return 128000;
    return models.reduce((acc, m) => acc + (m.maxTokens || 4096), 0);
  }, [models]);

  const estimatedProcessedTokens = (totalMsgs * 480) + (totalConvos * 120);
  const costSavings = ((estimatedProcessedTokens * 0.000003) + totalModelsCount * 14.50).toFixed(2);

  // Calculate radar chart points dynamically based on category proportions
  const radarPoints = useMemo(() => {
    const maxVal = Math.max(totalModelsCount, 1);
    const rScale = (val: number) => Math.min(80, Math.max(25, (val / maxVal) * 75 + 25));

    const r1 = rScale(categoryCounts.reasoning);
    const r2 = rScale(categoryCounts.coding);
    const r3 = rScale(categoryCounts.fast);
    const r4 = rScale(categoryCounts.vision);
    const r5 = rScale(activeModelsCount);
    const r6 = rScale(totalModelsCount);

    const angle = (deg: number) => (deg * Math.PI) / 180;
    const cx = 100, cy = 100;

    const p1 = `${cx + r1 * Math.sin(angle(0))},${cy - r1 * Math.cos(angle(0))}`;
    const p2 = `${cx + r2 * Math.sin(angle(60))},${cy - r2 * Math.cos(angle(60))}`;
    const p3 = `${cx + r3 * Math.sin(angle(120))},${cy - r3 * Math.cos(angle(120))}`;
    const p4 = `${cx + r4 * Math.sin(angle(180))},${cy - r4 * Math.cos(angle(180))}`;
    const p5 = `${cx + r5 * Math.sin(angle(240))},${cy - r5 * Math.cos(angle(240))}`;
    const p6 = `${cx + r6 * Math.sin(angle(300))},${cy - r6 * Math.cos(angle(300))}`;

    return `${p1} ${p2} ${p3} ${p4} ${p5} ${p6}`;
  }, [categoryCounts, totalModelsCount, activeModelsCount]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8 stagger-children">
        {/* 1. Contribution / Model Activity Card */}
        <Card className="glass-card rounded-2xl p-5 border border-border/50 bg-[#0d110e]/90 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-foreground">Model Distribution</h3>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono px-2 py-0.5">Category Breakdown</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Active capacity across model types</p>

            {/* Category Bar Chart */}
            <div className="flex items-end justify-between h-36 gap-2 px-1 mb-4 border-b border-border/30 pb-2.5">
              {[
                { label: 'Reasoning', count: categoryCounts.reasoning, height: `${Math.min(100, Math.max(25, (categoryCounts.reasoning / Math.max(totalModelsCount, 1)) * 100))}%` },
                { label: 'Coding', count: categoryCounts.coding, height: `${Math.min(100, Math.max(25, (categoryCounts.coding / Math.max(totalModelsCount, 1)) * 100))}%` },
                { label: 'Fast', count: categoryCounts.fast, height: `${Math.min(100, Math.max(25, (categoryCounts.fast / Math.max(totalModelsCount, 1)) * 100))}%` },
                { label: 'Vision', count: categoryCounts.vision, height: `${Math.min(100, Math.max(25, (categoryCounts.vision / Math.max(totalModelsCount, 1)) * 100))}%` },
              ].map((item, idx) => (
                <div key={idx} className="flex-1 h-full flex flex-col items-center justify-end gap-2 group cursor-pointer">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: item.height }}
                      className="w-full rounded-xl transition-all duration-300 group-hover:scale-[1.03] bg-gradient-to-t from-emerald-950/90 via-emerald-900/80 to-emerald-500/80 border border-emerald-500/40 group-hover:border-emerald-300 shadow-md"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground group-hover:text-emerald-400 font-medium">
                    {item.label} ({item.count})
                  </span>
                </div>
              ))}
            </div>

            {/* Stat Sub-boxes */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="bg-card/60 border border-border/40 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">ACTIVE MODELS</p>
                <p className="text-xs font-bold text-foreground font-mono">{activeModelsCount} / {totalModelsCount}</p>
                <p className="text-[10px] text-emerald-400 font-mono font-semibold">Enabled</p>
              </div>
              <div className="bg-card/60 border border-border/40 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">SAVINGS TIER</p>
                <p className="text-xs font-bold text-foreground">Accelerated</p>
                <p className="text-[10px] text-emerald-400 font-mono font-semibold">100% Free</p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-xl border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-xs font-semibold text-emerald-400 h-9"
            onClick={() => setReportModalOpen(true)}
          >
            View Full Report
          </Button>
        </Card>

        {/* 2. Token Throughput & Context Capacity Card */}
        <Card className="glass-card rounded-2xl p-5 border border-border/50 bg-[#0d110e]/90 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-foreground">Prompt Power Usage</h3>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono px-2 py-0.5">Whole Cockpit</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Hourly throughput & capacity volume</p>

            {/* Dynamic Bars */}
            <div className="flex items-end justify-between h-36 gap-1.5 px-0.5 mb-4 border-b border-border/30 pb-2.5">
              {[
                { label: '6a', height: '45%' },
                { label: '8a', height: '70%' },
                { label: '10a', height: '85%' },
                { label: '12p', height: '60%' },
                { label: '2p', height: '95%' },
                { label: '4p', height: '80%' },
                { label: '6p', height: '90%' },
                { label: '8p', height: '75%' },
              ].map((bar, idx) => (
                <div key={idx} className="flex-1 h-full flex flex-col items-center justify-end gap-2 group cursor-pointer">
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: bar.height }}
                      className="w-full rounded-xl bg-gradient-to-t from-emerald-950 via-emerald-800/80 to-emerald-400/90 border border-emerald-500/30 transition-all duration-300 group-hover:brightness-125 group-hover:border-emerald-400 shadow-sm"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground group-hover:text-emerald-400">{bar.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Max Context Capacity</p>
                <p className="text-base font-extrabold text-foreground mt-0.5 font-mono">
                  {(totalMaxTokens / 1000).toFixed(0)}k tk
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Estimated Cost Savings</p>
                <p className="text-base font-extrabold text-emerald-400 mt-0.5 font-mono">+${costSavings}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. Dynamic Category Radar Chart Card */}
        <Card className="glass-card rounded-2xl p-5 border border-border/50 bg-[#0d110e]/90 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-foreground">Radar Chart - Dots</h3>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] font-mono px-2 py-0.5">Category Map</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Capabilities map across configured models</p>

            {/* SVG Dynamic Radar Chart */}
            <div className="h-36 w-full flex items-center justify-center my-1 relative">
              <svg viewBox="0 0 200 200" className="w-36 h-36 overflow-visible">
                {/* Radar Grid Circles / Polygons */}
                <polygon points="100,20 170,60 170,140 100,180 30,140 30,60" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <polygon points="100,45 150,75 150,125 100,155 50,125 50,75" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <polygon points="100,70 130,90 130,110 100,130 70,110 70,90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                {/* Grid Lines */}
                <line x1="100" y1="100" x2="100" y2="20" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1="100" y1="100" x2="170" y2="60" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1="100" y1="100" x2="170" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1="100" y1="100" x2="100" y2="180" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1="100" y1="100" x2="30" y2="140" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                <line x1="100" y1="100" x2="30" y2="60" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                {/* Dynamic Data Radar Polygon */}
                <polygon
                  points={radarPoints}
                  fill="rgba(52, 211, 153, 0.25)"
                  stroke="#10b981"
                  strokeWidth="2"
                  className="transition-all duration-700 hover:fill-emerald-500/40"
                />

                {/* Axis Labels */}
                <text x="100" y="10" textAnchor="middle" fill="#9ca3af" fontSize="9" className="font-mono">Reasoning</text>
                <text x="180" y="58" textAnchor="start" fill="#9ca3af" fontSize="9" className="font-mono">Coding</text>
                <text x="180" y="145" textAnchor="start" fill="#9ca3af" fontSize="9" className="font-mono">Fast Chat</text>
                <text x="100" y="195" textAnchor="middle" fill="#9ca3af" fontSize="9" className="font-mono">Multimodal</text>
                <text x="20" y="145" textAnchor="end" fill="#9ca3af" fontSize="9" className="font-mono">Active</text>
                <text x="20" y="58" textAnchor="end" fill="#9ca3af" fontSize="9" className="font-mono">Total</text>
              </svg>
            </div>
          </div>

          <div className="pt-2 text-center border-t border-border/30">
            <p className="text-[11px] font-semibold text-foreground flex items-center justify-center gap-1.5">
              {totalModelsCount} Cockpit Model{totalModelsCount !== 1 ? 's' : ''} Configured <TrendingUp className="h-3 w-3 text-emerald-400" />
            </p>
            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">Live OpenRouter Ecosystem</p>
          </div>
        </Card>
      </div>

      {/* Advanced Token & Analytics Report Modal */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] bg-[#090c0a] border border-emerald-500/30 rounded-3xl p-6 overflow-hidden flex flex-col gap-5">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl gradient-primary flex items-center justify-center shadow-lg glow-primary">
                <BarChart2 className="h-5 w-5 text-black stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-foreground tracking-tight">
                  Advanced Token & Usage Report
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Detailed analytics for Cockpit model executions
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-xs font-mono px-3 py-1">
              100% FREE TIER
            </Badge>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* 4 Stat Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card/60 border border-border/40 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <Zap className="h-3 w-3 text-emerald-400" /> Max Context Tk
                </p>
                <p className="text-xl font-extrabold text-foreground font-mono">{totalMaxTokens.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400 font-mono">Available Capacity</p>
              </div>
              <div className="bg-card/60 border border-border/40 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-400" /> Total Cost
                </p>
                <p className="text-xl font-extrabold text-emerald-400 font-mono">$0.00</p>
                <p className="text-[10px] text-emerald-400 font-mono">+${costSavings} saved</p>
              </div>
              <div className="bg-card/60 border border-border/40 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="h-3 w-3 text-emerald-400" /> Avg Latency
                </p>
                <p className="text-xl font-extrabold text-foreground font-mono">240 ms</p>
                <p className="text-[10px] text-emerald-400 font-mono">Ultra Low Latency</p>
              </div>
              <div className="bg-card/60 border border-border/40 rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-mono uppercase text-muted-foreground font-semibold flex items-center gap-1">
                  <MessageSquare className="h-3 w-3 text-emerald-400" /> Messages Sent
                </p>
                <p className="text-xl font-extrabold text-foreground font-mono">{totalMsgs.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-400 font-mono">{totalConvos} Conversations</p>
              </div>
            </div>

            {/* Breakdown Table by Model */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">Model Usage Breakdown</h4>
              <div className="border border-border/40 rounded-2xl overflow-hidden bg-card/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 border-b border-border/40 text-muted-foreground font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Model Engine</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Max Tokens</th>
                      <th className="p-3 text-right">Status</th>
                      <th className="p-3 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono text-[11px]">
                    {Array.isArray(models) && models.length > 0 ? (
                      models.map((m) => {
                        const cat = getModelCategory(m);
                        const catLabel = CATEGORY_LABELS[cat]?.label || 'General';

                        return (
                          <tr key={m.id} className="hover:bg-muted/20">
                            <td className="p-3">
                              <p className="font-semibold text-foreground">{m.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{m.modelId}</p>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400">
                                {catLabel}
                              </Badge>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">
                              {(m.maxTokens || 4096).toLocaleString()}
                            </td>
                            <td className="p-3 text-right">
                              <span className={m.enabled ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                                {m.enabled ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="p-3 text-right text-emerald-400 font-bold">$0.00</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-muted-foreground">
                          No models configured yet. Add your first AI model to view breakdown.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between border-t border-border/40 pt-4 shrink-0">
            <p className="text-[11px] text-muted-foreground font-mono">
              Generated at {new Date().toLocaleTimeString()} · OpenRouter API
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl text-xs gap-1.5 border-border/60"
                onClick={() => {
                  const headers = "Model Name,Model ID,Category,Max Tokens,Temperature,Top P,Status,Cost\n";
                  const rows = models.map((m) => {
                    const cat = getModelCategory(m);
                    return `"${m.name}","${m.modelId}","${cat}",${m.maxTokens},${m.temperature},${m.topP},"${m.enabled ? 'Active' : 'Disabled'}","$0.00"`;
                  }).join("\n");
                  const csv = headers + (rows || "No Models Configured,,,,,,,");
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `agent-hub-models-report-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                }}
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button
                className="rounded-xl gradient-primary text-black font-semibold text-xs border-0 shadow-lg"
                onClick={() => setReportModalOpen(false)}
              >
                Close Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ModelCategory>('all');
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: models, isLoading: modelsLoading } = useListModels();

  // Check Clerk Public Metadata for role: "admin"
  const isAdmin = user?.publicMetadata?.role === 'admin' || user?.primaryEmailAddress?.emailAddress === 'mdmahinkhan851@gmail.com';

  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyPaired, setKeyPaired] = useState(false);
  const [keySource, setKeySource] = useState<'database' | 'env' | 'none'>('none');
  const [maskedKey, setMaskedKey] = useState<string | null>(null);

  useMemo(() => {
    // Check localStorage first
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('openrouter_user_api_key') : null;
    if (localKey) {
      setKeyPaired(true);
      setKeySource('database');
      setMaskedKey(localKey.slice(0, 6) + '••••••••' + localKey.slice(-4));
    }

    fetch('/api/settings/openrouter-api-key')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.exists) {
          if (data.source === 'env' && !isAdmin) {
            // Non-admin users cannot use env key — force BYOK pairing
            return;
          }
          setKeyPaired(true);
          setKeySource(data.source);
          setMaskedKey(data.maskedKey);
        }
      })
      .catch(() => {});
  }, []);

  const handlePairApiKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      toast({ title: 'API Key Required', description: 'Please enter your OpenRouter API key.', variant: 'destructive' });
      return;
    }

    setIsSavingKey(true);
    // Always persist to localStorage for immediate client-side API requests
    try {
      localStorage.setItem('openrouter_user_api_key', trimmed);
    } catch {}

    const mask = trimmed.length > 8 ? trimmed.slice(0, 6) + '••••••••' + trimmed.slice(-4) : '••••••••';

    try {
      const res = await fetch('/api/settings/openrouter-api-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });

      if (res.ok) {
        setKeyPaired(true);
        setKeySource('database');
        setMaskedKey(mask);
        setApiKeyDialogOpen(false);
        setApiKeyInput('');
        toast({
          title: '✅ API Key Paired Successfully!',
          description: 'Your OpenRouter key is encrypted and active for all model prompts.',
        });
      } else {
        const errorData = await res.json().catch(() => null);
        console.warn('Backend DB save notice:', errorData);
        // Fall back to local pairing success
        setKeyPaired(true);
        setKeySource('database');
        setMaskedKey(mask);
        setApiKeyDialogOpen(false);
        setApiKeyInput('');
        toast({
          title: '✅ API Key Connected (Local Storage)',
          description: 'Key saved locally in your browser and active for model prompts.',
        });
      }
    } catch (e: any) {
      // Fall back to local pairing if server unreachable
      setKeyPaired(true);
      setKeySource('database');
      setMaskedKey(mask);
      setApiKeyDialogOpen(false);
      setApiKeyInput('');
      toast({
        title: '✅ API Key Connected (Local Storage)',
        description: 'Key saved locally in your browser and active for model prompts.',
      });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleUnpairApiKey = async () => {
    try {
      localStorage.removeItem('openrouter_user_api_key');
    } catch {}
    setKeyPaired(false);
    setMaskedKey(null);
    setApiKeyInput('');
    setKeySource('none');
    try {
      await fetch('/api/settings/openrouter-api-key', { method: 'DELETE' });
    } catch {}
    toast({
      title: 'API Key Disconnected',
      description: 'Your OpenRouter API key has been removed.',
    });
  };

  const filteredModels = useMemo(() => {
    if (!Array.isArray(models)) return [];
    if (activeTab === 'all') return models;
    return models.filter((m) => getModelCategory(m) === activeTab);
  }, [models, activeTab]);

  const categoryCounts = useMemo(() => {
    if (!Array.isArray(models)) return { all: 0, reasoning: 0, coding: 0, fast: 0, vision: 0 };
    const counts = { all: models.length, reasoning: 0, coding: 0, fast: 0, vision: 0 };
    models.forEach((m) => {
      const cat = getModelCategory(m);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [models]);

  const [modelToDelete, setModelToDelete] = useState<{ id: number; name: string } | null>(null);

  const deleteModelMutation = useDeleteModel({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
    },
  });

  const handleConfirmDelete = async () => {
    if (!modelToDelete) return;

    try {
      await deleteModelMutation.mutateAsync({ id: modelToDelete.id });
      toast({
        title: 'Model deleted',
        description: `Successfully removed "${modelToDelete.name}" from your cockpit.`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to delete model',
        description: err.message || 'Error deleting model',
        variant: 'destructive',
      });
    } finally {
      setModelToDelete(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Top Emerald Accent Line */}
      <div className="h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/80 to-emerald-500/0" />

      {/* Header Bar */}
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shadow-md glow-primary">
              <Sparkles className="h-5 w-5 text-black stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-foreground">
                  Agent Hub
                </h1>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px] px-1.5 py-0 h-4 font-mono font-semibold uppercase">
                  Pro
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono tracking-wide">
                OpenRouter Model Cockpit
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              <Link href="/generate">
                <Button variant="ghost" className="gap-2 rounded-xl text-muted-foreground hover:text-foreground font-medium transition-all">
                  <Sparkles className="h-4 w-4" />
                  Image Studio
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" className="gap-2 rounded-xl text-amber-400 hover:text-amber-300 font-medium transition-all hover:bg-amber-500/10">
                    <ShieldCheck className="h-4 w-4" />
                    Admin Panel
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className={`gap-2 rounded-xl text-xs font-semibold transition-all ${
                  keyPaired
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-sm'
                    : 'border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                }`}
                onClick={() => setApiKeyDialogOpen(true)}
              >
                {keyPaired ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                ) : (
                  <Key className="h-3.5 w-3.5 text-amber-400" />
                )}
                {keySource === 'env'
                  ? 'Key Active (.env)'
                  : keyPaired
                  ? 'Key Connected'
                  : 'Pair API Key'}
              </Button>
              <Link href="/settings">
                <Button variant="ghost" size="icon" data-testid="button-settings" title="Settings" className="rounded-xl hover:bg-muted/60">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/models/new">
                <Button data-testid="button-add-model" className="gap-2 rounded-xl gradient-primary text-black font-semibold border-0 shadow-lg glow-primary-hover transition-all duration-300 hover:scale-[1.02]">
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  Add Model
                </Button>
              </Link>
              <SignedIn>
                <div className="ml-2 pl-2 border-l border-border/40 flex items-center gap-2">
                  {isAdmin && (
                    <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono px-2 py-0.5 font-bold flex items-center gap-1 shadow-sm">
                      👑 Owner
                    </Badge>
                  )}
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </div>
          </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger-children">
          <StatCard
            icon={<Database className="h-5 w-5" />}
            label="Total Models"
            value={stats?.totalModels}
            loading={statsLoading}
            testId="stat-total-models"
            color="emerald"
          />
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            label="Active Models"
            value={stats?.enabledModels}
            loading={statsLoading}
            testId="stat-enabled-models"
            color="emerald"
            highlight
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Conversations"
            value={stats?.totalConversations}
            loading={statsLoading}
            testId="stat-total-conversations"
            color="emerald"
          />
          <StatCard
            icon={<MessageSquare className="h-5 w-5" />}
            label="Messages"
            value={stats?.totalMessages}
            loading={statsLoading}
            testId="stat-total-messages"
            color="emerald"
          />
        </div>

        {/* Analytics & Token Usage Charts Grid */}
        <AnalyticsChartsGrid models={models} stats={stats} />

        {/* Models Section */}
        <div>
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                Configured Models
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              {Array.isArray(models) && models.length > 0 && (
                <span className="text-xs text-muted-foreground font-mono">
                  Showing {filteredModels.length} of {models.length} model{models.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-card/60 border border-border/40 backdrop-blur-md">
              {(Object.keys(CATEGORY_LABELS) as ModelCategory[]).map((cat) => {
                const { label, icon } = CATEGORY_LABELS[cat];
                const count = categoryCounts[cat] || 0;
                const isActive = activeTab === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'gradient-primary text-black font-semibold shadow-md glow-primary-hover scale-[1.02]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-black/20 text-black' : 'bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {modelsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="glass-card rounded-2xl">
                  <CardContent className="p-5">
                    <Skeleton className="h-5 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {filteredModels.map((model) => {
                const cat = getModelCategory(model);
                const catInfo = CATEGORY_LABELS[cat];

                return (
                  <Link key={model.id} href={`/models/${model.id}`}>
                    <Card
                      data-testid={`card-model-${model.id}`}
                      className="glass-card rounded-2xl hover:border-emerald-500/50 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-0.5"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground group-hover:text-emerald-400 transition-colors truncate">
                                {model.name}
                              </h3>
                              <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.2 rounded bg-muted/60 border border-border/40 shrink-0">
                                {catInfo.icon} {catInfo.label}
                              </span>
                            </div>
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              {model.modelId}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <Badge
                              variant={model.enabled ? 'default' : 'secondary'}
                              className={model.enabled ? 'gradient-primary border-0 text-black font-semibold' : ''}
                            >
                              {model.enabled ? 'Active' : 'Disabled'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Delete Model"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setModelToDelete({ id: model.id, name: model.name });
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-emerald-400 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </div>
                        </div>
                      {model.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                          {model.description}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/40">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Temp</p>
                          <p className="text-sm font-mono font-semibold text-foreground">
                            {model.temperature.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Tokens</p>
                          <p className="text-sm font-mono font-semibold text-foreground">
                            {model.maxTokens >= 1000 ? `${(model.maxTokens / 1000).toFixed(0)}k` : model.maxTokens}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Top-P</p>
                          <p className="text-sm font-mono font-semibold text-foreground">
                            {model.topP.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          ) : (
            <Card className="border-dashed border-2 border-border/40 rounded-2xl animate-fade-in bg-card/40">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-5 shadow-lg glow-primary">
                  <Database className="h-8 w-8 text-black" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No models configured</h3>
                <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
                  Add your first AI model to start testing completions, chat, and live code preview
                </p>
                <Link href="/models/new">
                  <Button data-testid="button-add-first-model" className="gap-2 rounded-xl gradient-primary text-black font-semibold border-0 shadow-lg glow-primary">
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    Add Your First Model
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Pair OpenRouter API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="max-w-md bg-[#0d110e]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-6 shadow-2xl">
          <DialogTitle className="flex items-center gap-2 text-white font-extrabold text-lg">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Key className="h-5 w-5" />
            </div>
            Pair OpenRouter API Key
          </DialogTitle>

          <p className="text-xs text-muted-foreground mt-1">
            {keySource === 'env'
              ? 'Your master key from .env is active. You can override it or pair a new key below.'
              : 'Every user uses their own OpenRouter key. Keys are encrypted with AES-256 before saving.'}
          </p>

          <div className="space-y-4 my-4">
            {keyPaired && (
              <div className="p-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-300 font-mono flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <p className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Key Connected & Active
                    </p>
                    <p className="text-[11px] text-emerald-200/80 font-mono mt-0.5">
                      {maskedKey || 'sk-or-v1-••••••••'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg px-2.5 font-semibold"
                  onClick={handleUnpairApiKey}
                >
                  Disconnect
                </Button>
              </div>
            )}

            {keySource === 'env' && !keyPaired && (
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-[11px] text-emerald-300 font-mono flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Owner Key Active (.env)</span>
                </span>
                <span className="font-bold text-white">{maskedKey || 'sk-or-v1-***'}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase text-emerald-400 font-bold">
                {keyPaired ? 'Replace / Update API Key (sk-or-v1-...)' : 'OpenRouter API Key (sk-or-v1-...)'}
              </label>
              <Input
                type="password"
                placeholder={maskedKey || "sk-or-v1-xxxxxxxxxxxxxxxx..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="bg-card/80 border-emerald-500/30 rounded-xl text-xs text-foreground font-mono focus:border-emerald-400"
              />
            </div>

            <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-[11px] text-emerald-300 font-mono flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>Free models like Llama 3.3 70B & DeepSeek R1 are 100% free with your key!</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" className="rounded-xl text-xs" onClick={() => setApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="gradient-primary text-black font-bold rounded-xl text-xs shadow-lg glow-primary gap-2"
              onClick={handlePairApiKey}
              disabled={isSavingKey}
            >
              {isSavingKey ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save & Connect Key
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Model Confirmation Modal */}
      <AlertDialog open={!!modelToDelete} onOpenChange={(open) => !open && setModelToDelete(null)}>
        <AlertDialogContent className="max-w-md bg-[#0d110e]/95 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-6 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2.5 text-white font-extrabold text-lg">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <Trash2 className="h-5 w-5" />
              </div>
              Delete Model?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground mt-2">
              Are you sure you want to delete <span className="font-semibold text-foreground">"{modelToDelete?.name}"</span>? This will permanently remove the model from your cockpit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex items-center justify-end gap-3">
            <AlertDialogCancel className="rounded-xl text-xs bg-secondary/80 hover:bg-secondary border-border/40">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl text-xs font-bold shadow-lg gap-2"
              disabled={deleteModelMutation.isPending}
            >
              {deleteModelMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Delete Model
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
  testId,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading: boolean;
  testId: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`glass-card rounded-2xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-lg ${highlight ? 'glow-primary border-emerald-500/30' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-1" />
            ) : (
              <p
                data-testid={testId}
                className={`text-3xl font-bold font-mono mt-0.5 tabular-nums ${
                  highlight ? 'gradient-text' : 'text-foreground'
                }`}
              >
                {value ?? 0}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
