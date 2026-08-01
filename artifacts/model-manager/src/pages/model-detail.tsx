import { useState, useRef, useEffect, useCallback } from 'react';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { useParams, useLocation, Link } from 'wouter';
import { useUser } from '@clerk/clerk-react';
import {
  useGetModel,
  useUpdateModel,
  useDeleteModel,
  useListModelConversations,
  useCreateModelConversation,
  useDeleteModelConversation,
  getGetModelQueryKey,
  getListModelConversationsQueryKey,
  getGetStatsQueryKey,
  getListModelsQueryKey,
  getSendModelMessageUrl,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Trash2,
  Plus,
  MessageSquare,
  Settings,
  Send,
  Bot,
  User,
  Loader2,
  ChevronRight,
  Globe,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModelForm } from '@/components/model-form';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { extractPreview } from '@/lib/extract-preview';
import type { ModelInput } from '@workspace/api-client-react';

const PREVIEWABLE_LANGS = new Set(['html', 'css', 'javascript', 'js', 'jsx', 'tsx']);

type Message = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

export default function ModelDetail() {
  const { id } = useParams<{ id: string }>();
  const modelId = Number(id);
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'chat' | 'config'>('chat');

  // Active conversation
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  const [reasoningText, setReasoningText] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: model, isLoading: modelLoading } = useGetModel(modelId);
  const { data: conversations, isLoading: convsLoading } = useListModelConversations(modelId);
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const createConversation = useCreateModelConversation();
  const deleteConversation = useDeleteModelConversation();

  // Auto-focus prompt text area whenever sending completes or active conversation changes
  useEffect(() => {
    if (!isSending) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [isSending, activeConvId]);

  // Auto-scroll to bottom directly without window layout reflow
  useEffect(() => {
    const viewport =  scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
  }, [messages, reasoningText]);

  const handleUpdate = async (data: ModelInput) => {
    updateModel.mutate(
      { id: modelId, data },
      {
        onSuccess: () => {
          toast({ title: 'Saved', description: 'Model configuration updated.' });
          queryClient.invalidateQueries({ queryKey: getGetModelQueryKey(modelId) });
          queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
          setActiveTab('chat');
        },
        onError: (err: any) => {
          toast({
            title: 'Save failed',
            description: err?.message || 'An error occurred',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteModel.mutate(
      { id: modelId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          toast({ title: 'Deleted', description: 'Model removed.' });
          setLocation('/');
        },
        onError: (err: any) => {
          toast({
            title: 'Delete failed',
            description: err?.message || 'An error occurred',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleNewConversation = () => {
    const title = `Chat ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    createConversation.mutate(
      { modelId, data: { title } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListModelConversationsQueryKey(modelId) });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          handleSelectConversation(conv.id);
          setActiveTab('chat');
          setTimeout(() => {
            textareaRef.current?.focus();
          }, 100);
        },
        onError: (err: any) => {
          toast({
            title: 'Failed to start conversation',
            description: err?.message || 'An error occurred',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleSelectConversation = useCallback((convId: number) => {
    setActiveConvId(convId);
    localStorage.setItem(`active_conv_${modelId}`, String(convId));
    setMessages([]);
    // Fetch messages for this conversation with proper user identity headers
    const url = `/api/models/${modelId}/conversations/${convId}/messages`;
    const headers: Record<string, string> = {};
    const userEmail = user?.primaryEmailAddress?.emailAddress || (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress;
    if (userEmail) {
      headers['x-user-email'] = userEmail;
    }
    const localKey = typeof window !== 'undefined' ? localStorage.getItem('openrouter_user_api_key') : null;
    if (localKey) {
      headers['x-openrouter-key'] = localKey;
    }

    fetch(url, { headers })
      .then((r) => r.json())
      .then((msgs) => {
        if (Array.isArray(msgs)) {
          setMessages(
            msgs.map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
          );
        }
      })
      .catch(() => {});
  }, [modelId, user]);

  // Auto-restore / auto-select active conversation on page load or reload
  useEffect(() => {
    if (!conversations || conversations.length === 0) return;

    const savedConvId = localStorage.getItem(`active_conv_${modelId}`);
    let targetConv = savedConvId ? conversations.find(c => c.id === Number(savedConvId)) : null;

    if (!targetConv) {
      targetConv = conversations[conversations.length - 1];
    }

    if (targetConv && (!activeConvId || !conversations.some(c => c.id === activeConvId))) {
      handleSelectConversation(targetConv.id);
    }
  }, [conversations, modelId, activeConvId, handleSelectConversation]);

  const handleDeleteConversation = (convId: number) => {
    deleteConversation.mutate(
      { modelId, id: convId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListModelConversationsQueryKey(modelId) });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          if (activeConvId === convId) {
            setActiveConvId(null);
            setMessages([]);
          }
        },
      }
    );
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending || !activeConvId) return;

    const userContent = inputText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: userContent }]);
    setIsSending(true);
    setCurrentStage('preparing');
    setSearchingQuery(null);
    setReasoningText('');

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const url = getSendModelMessageUrl(modelId, activeConvId);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const localKey = typeof window !== 'undefined' ? localStorage.getItem('openrouter_user_api_key') : null;
      if (localKey) {
        headers['x-openrouter-key'] = localKey;
      }
      const userEmail = user?.primaryEmailAddress?.emailAddress || (window as any).Clerk?.user?.primaryEmailAddress?.emailAddress;
      if (userEmail) {
        headers['x-user-email'] = userEmail;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: userContent }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          try {
            const json = JSON.parse(payload);
            if (json.stage) {
              setCurrentStage(json.stage);
              if (json.stage === 'searching') setSearchingQuery(json.query ?? '…');
              if (json.stage === 'generating') setSearchingQuery(null);
            }
            // legacy compat
            if (json.searching === true) {
              setCurrentStage('searching');
              setSearchingQuery(json.query ?? '…');
            }
            if (json.error) {
              fullContent = `Error: ${json.error}`;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: fullContent, streaming: false };
                }
                return next;
              });
            }
            if (json.content) {
              setCurrentStage('generating');
              setSearchingQuery(null);
              fullContent += json.content;
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: fullContent };
                }
                return next;
              });
            }
            if (json.done) {
              setSearchingQuery(null);
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                }
                return next;
              });
              // Auto-extract preview from completed AI message
              const preview = extractPreview(fullContent);
              if (preview) {
                setPreviewHtml(preview);
                setShowPreview(true);
              }
            }
          } catch {}
        }
      }

      queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = {
            ...last,
            content: `Error: ${err.message || 'Streaming failed'}`,
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      setIsSending(false);
      setCurrentStage('');
      setSearchingQuery(null);
    }
  };

  const handleOpenPreview = useCallback((code: string, lang: string) => {
    if (PREVIEWABLE_LANGS.has(lang)) {
      const preview = extractPreview(code);
      if (preview) {
        setPreviewHtml(preview);
        setShowPreview(true);
        setSidebarOpen(false);
      }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (modelLoading) {
    return (
      <div className="h-screen max-h-screen overflow-hidden bg-background flex flex-col noise-bg select-none">
        {/* Gradient accent strip */}
        <div className="h-[2px] w-full gradient-primary shrink-0 opacity-60 animate-pulse" />

        {/* Top Header Skeleton */}
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-xl shrink-0 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-xl bg-emerald-500/10" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40 rounded-lg bg-emerald-500/15" />
                  <Skeleton className="h-4 w-14 rounded-full bg-emerald-500/20" />
                </div>
                <Skeleton className="h-3 w-28 rounded-md bg-muted/60" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-36 rounded-xl bg-muted/60" />
              <Skeleton className="h-8 w-8 rounded-xl bg-muted/60" />
            </div>
          </div>
        </div>

        {/* Main Content Body Skeleton */}
        <div className="flex-1 w-full px-5 py-4 flex gap-5 min-h-0 overflow-hidden">
          {/* Left Sidebar Skeleton */}
          <aside className="w-64 shrink-0 flex flex-col gap-3 h-full overflow-hidden glass-card rounded-2xl p-3">
            <div className="flex items-center justify-between px-1 pt-1">
              <Skeleton className="h-3 w-24 rounded-md bg-muted/60" />
            </div>
            <Skeleton className="h-9 w-full rounded-xl bg-emerald-500/15" />
            <div className="space-y-2.5 pt-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border/30 bg-card/40">
                  <Skeleton className="h-3.5 w-3.5 rounded-full bg-emerald-500/20 shrink-0" />
                  <Skeleton className={`h-3.5 rounded-md bg-muted/60 ${i % 2 === 0 ? 'w-32' : 'w-24'}`} />
                </div>
              ))}
            </div>
          </aside>

          {/* Middle Chat Skeleton */}
          <div className="flex-1 h-full flex flex-col justify-between min-h-0 overflow-hidden glass-card rounded-2xl p-4">
            <div className="space-y-5 flex-1 pr-2">
              {/* User Bubble Skeleton */}
              <div className="flex flex-row-reverse gap-3">
                <Skeleton className="h-7 w-7 rounded-xl bg-emerald-500/20 shrink-0" />
                <Skeleton className="h-10 w-64 rounded-2xl bg-emerald-500/15" />
              </div>

              {/* Assistant Message Skeleton */}
              <div className="flex gap-3">
                <Skeleton className="h-7 w-7 rounded-xl bg-muted/80 shrink-0" />
                <div className="flex-1 max-w-[85%] space-y-2.5 p-4 rounded-2xl border border-border/40 bg-card/60">
                  <Skeleton className="h-4 w-3/4 rounded-md bg-muted/70" />
                  <Skeleton className="h-4 w-1/2 rounded-md bg-muted/60" />
                  <Skeleton className="h-28 w-full rounded-xl bg-black/60 border border-emerald-950/60" />
                </div>
              </div>
            </div>

            {/* Bottom Prompt Bar Skeleton */}
            <div className="shrink-0 pt-3 border-t border-border/30 mt-3">
              <div className="flex gap-2 items-center glass-card rounded-2xl p-2 h-12">
                <Skeleton className="h-4 flex-1 rounded-md bg-muted/40 ml-2" />
                <Skeleton className="h-8 w-8 rounded-xl bg-emerald-500/20 shrink-0" />
                <Skeleton className="h-8 w-8 rounded-xl bg-emerald-500/30 shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Model not found.</p>
          <Link href="/">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-background flex flex-col noise-bg">
      {/* Gradient accent strip */}
      <div className="h-[2px] w-full gradient-primary shrink-0" />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'config')} className="h-full flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-xl shrink-0">
          <div className="w-full px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link href="/">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted/50" data-testid="button-back">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                  onClick={() => setSidebarOpen((v) => !v)}
                  title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                >
                  {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4 text-emerald-400" />}
                </Button>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-base font-bold text-foreground tracking-tight">{model.name}</h1>
                    <Badge
                      variant={model.enabled ? 'default' : 'secondary'}
                      className={model.enabled ? 'gradient-primary border-0 text-black font-semibold text-[10px]' : 'text-[10px]'}
                    >
                      {model.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground tracking-wide">{model.modelId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Tabs switcher in top header */}
                <TabsList className="h-8 p-1 rounded-xl bg-muted/60 border border-border/40">
                  <TabsTrigger value="chat" className="h-6 px-3 text-xs gap-1.5 rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 font-medium transition-all">
                    <MessageSquare className="h-3.5 w-3.5" /> Chat
                  </TabsTrigger>
                  <TabsTrigger value="config" className="h-6 px-3 text-xs gap-1.5 rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 font-medium transition-all">
                    <Settings className="h-3.5 w-3.5" /> Config
                  </TabsTrigger>
                </TabsList>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {model.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the model and all its conversations. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

      {/* Body */}
      <div className="flex-1 w-full px-5 py-4 flex gap-5 min-h-0 overflow-hidden">
        {/* Sidebar: conversations */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 flex flex-col gap-3 h-full overflow-hidden glass-card rounded-2xl p-3 animate-slide-up">
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Conversations</span>
            </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full shrink-0 rounded-xl border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
            onClick={handleNewConversation}
            disabled={createConversation.isPending || activeTab === 'config'}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>

          <ScrollArea className="flex-1 min-h-0">
            {convsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-1">
                {[...conversations].reverse().map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-all duration-200 ${
                      activeConvId === conv.id
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-transparent'
                    }`}
                    onClick={() => { handleSelectConversation(conv.id); setActiveTab('chat'); }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-xs truncate font-medium">{conv.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity duration-200"
                      onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
            )}
          </ScrollArea>
        </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <TabsContent value="chat" className="mt-0 h-full flex-1 flex flex-col min-h-0 overflow-hidden data-[state=inactive]:hidden">
              {activeConvId ? (
                <ResizablePanelGroup direction="horizontal" className="h-full w-full flex-1 min-h-0 min-w-0">
                  <ResizablePanel id="chat" order={1} defaultSize={showPreview ? 45 : 100} minSize={25} className="min-w-0">
                    <div className="flex flex-col h-full justify-between min-h-0 min-w-0 overflow-hidden">
                  <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 min-w-0 w-full overflow-hidden pr-2">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full text-muted-foreground my-auto animate-fade-in">
                        <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg glow-primary">
                          <Bot className="h-7 w-7 text-black stroke-[2.2]" />
                        </div>
                        <p className="text-sm font-medium text-foreground mb-1">Start a conversation</p>
                        <p className="text-xs text-muted-foreground">Send a message to begin chatting</p>
                      </div>
                    ) : (
                      <div className="w-full space-y-5 pb-4 min-w-0 overflow-hidden">
                      {messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 animate-slide-up w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start'}`}
                        >
                          {msg.role === 'assistant' && (
                            <div className="shrink-0 h-7 w-7 rounded-xl flex items-center justify-center text-xs shadow-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                              <Bot className="h-3.5 w-3.5" />
                            </div>
                          )}
                          <div
                            className={
                              msg.role === 'user'
                                ? 'w-fit max-w-[80%] rounded-2xl px-4 py-2.5 text-sm gradient-primary text-black font-medium shadow-md shadow-emerald-500/10'
                                : 'w-fit max-w-[88%] min-w-0 rounded-2xl px-4 py-3 text-sm bg-card/60 text-foreground border border-border/40 shadow-sm overflow-hidden'
                            }
                          >
                            {msg.role === 'user' ? (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            ) : msg.content ? (
                              <MarkdownRenderer
                                content={msg.content}
                                streaming={msg.streaming}
                                onOpenPreview={handleOpenPreview}
                              />
                            ) : msg.streaming ? (
                              <div className="space-y-2 min-w-[180px]">
                                {/* Stage progress indicator */}
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  {currentStage === 'searching' ? (
                                    <>
                                      <Globe className="h-3 w-3 animate-pulse text-sky-500 shrink-0" />
                                      <span>Searching: <em>{searchingQuery}</em></span>
                                    </>
                                  ) : currentStage === 'generating' ? (
                                    <>
                                      <span className="inline-flex gap-0.5">
                                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                                      </span>
                                      <span>Generating…</span>
                                    </>
                                  ) : (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                      <span>Preparing context…</span>
                                    </>
                                  )}
                                </div>
                                {/* Reasoning tokens (thinking models) */}
                                {reasoningText && (
                                  <details open className="text-xs">
                                    <summary className="cursor-pointer select-none text-muted-foreground opacity-70 hover:opacity-100 flex items-center gap-1">
                                      <span>Thinking</span>
                                    </summary>
                                    <pre className="mt-1.5 whitespace-pre-wrap font-mono text-[11px] leading-relaxed opacity-60 max-h-48 overflow-y-auto border-l-2 border-border pl-2">
                                      {reasoningText}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ) : null}
                          </div>
                          {msg.role === 'user' && (
                            <div className="shrink-0 h-7 w-7 rounded-xl flex items-center justify-center text-xs shadow-sm gradient-primary text-black font-bold mt-0.5">
                              <User className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                    )}
                  </ScrollArea>

                  <div className="shrink-0 pt-3 border-t border-border/30 mt-3 w-full">
                    <div className="w-full flex gap-2 items-end glass-card rounded-2xl p-2 shadow-xl border border-border/50">
                      <Textarea
                        ref={textareaRef}
                        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSending}
                        className="resize-none min-h-[44px] max-h-[120px] border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                        rows={1}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={() => {
                          setShowPreview((p) => {
                            const next = !p;
                            if (next) setSidebarOpen(false);
                            return next;
                          });
                        }}
                        size="icon"
                        variant={showPreview ? 'default' : 'ghost'}
                        title={showPreview ? 'Hide preview' : 'Show preview'}
                        className={`shrink-0 rounded-xl transition-all duration-200 ${showPreview ? 'gradient-primary text-black font-bold border-0' : 'hover:bg-muted/50'}`}
                      >
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        size="icon"
                        data-testid="button-send"
                        className="shrink-0 rounded-xl gradient-primary text-black font-bold border-0 shadow-lg glow-primary-hover transition-all duration-300 hover:scale-105 disabled:opacity-30 disabled:shadow-none"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                    </div>
                  </ResizablePanel>

                  {showPreview && (
                    <>
                      <ResizableHandle withHandle />
                      <ResizablePanel id="preview" order={2} defaultSize={50} minSize={20}>
                        <div className="flex flex-col h-full border-l border-border/30">
                          {/* Preview header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 shrink-0 bg-card/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                              <Monitor className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="text-xs font-medium text-foreground">Preview</span>
                              {previewHtml && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> live</span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  if (previewIframeRef.current && previewHtml) {
                                    previewIframeRef.current.srcdoc = previewHtml;
                                  }
                                }}
                                disabled={!previewHtml}
                                title="Refresh preview"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  if (!previewHtml) return;
                                  const blob = new Blob([previewHtml], { type: 'text/html' });
                                  const url = URL.createObjectURL(blob);
                                  window.open(url, '_blank');
                                }}
                                disabled={!previewHtml}
                                title="Open in new tab"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Preview content */}
                          {previewHtml ? (
                            <iframe
                              ref={previewIframeRef}
                              srcDoc={previewHtml}
                              className="flex-1 w-full"
                              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                              title="Live Preview"
                            />
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8 text-center">
                              <Monitor className="h-12 w-12 opacity-20" />
                              <div>
                                <p className="text-sm font-medium mb-1">No preview yet</p>
                                <p className="text-xs opacity-70">
                                  Ask the AI to build something — HTML, CSS, JS, or a React component will appear here automatically.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              ) : (
                <Card className="border-dashed border-2 border-border/40 h-[calc(100vh-200px)] flex items-center justify-center rounded-2xl animate-fade-in bg-card/40">
                  <CardContent className="flex flex-col items-center text-center p-8">
                    <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-5 shadow-lg glow-primary">
                      <MessageSquare className="h-8 w-8 text-black" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                    <p className="text-sm text-muted-foreground mb-8">
                      Start a new conversation to test <span className="font-medium text-foreground">{model.name}</span>
                    </p>
                    <Button onClick={handleNewConversation} disabled={createConversation.isPending} className="rounded-xl gradient-primary text-black font-semibold border-0 shadow-lg glow-primary-hover transition-all duration-300 hover:scale-[1.02]">
                      <Plus className="h-4 w-4 mr-2 stroke-[2.5]" />
                      New Chat
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="config" className="mt-0">
              <ScrollArea className="h-[calc(100vh-140px)] pr-4">
                <ModelForm
                  defaultValues={model}
                  onSubmit={handleUpdate}
                  isSubmitting={updateModel.isPending}
                  submitLabel="Save Changes"
                />
              </ScrollArea>
            </TabsContent>
        </div>
      </div>
      </Tabs>
    </div>
  );
}
