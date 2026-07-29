import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams, useLocation, Link } from 'wouter';
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
import type { ModelInput } from '@workspace/api-client-react';

type Message = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
};

export default function ModelDetail() {
  const { id } = useParams<{ id: string }>();
  const modelId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'chat' | 'config'>('chat');

  // Active conversation
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: model, isLoading: modelLoading } = useGetModel(modelId);
  const { data: conversations, isLoading: convsLoading } = useListModelConversations(modelId);
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const createConversation = useCreateModelConversation();
  const deleteConversation = useDeleteModelConversation();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const title = `Chat ${new Date().toLocaleTimeString()}`;
    createConversation.mutate(
      { modelId, data: { title } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListModelConversationsQueryKey(modelId) });
          queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
          setActiveConvId(conv.id);
          setMessages([]);
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

  const handleSelectConversation = (convId: number) => {
    if (convId === activeConvId) return;
    setActiveConvId(convId);
    setMessages([]);
    // Fetch messages for this conversation
    const url = `/api/models/${modelId}/conversations/${convId}/messages`;
    fetch(url)
      .then((r) => r.json())
      .then((msgs: Array<{ id: number; role: string; content: string }>) => {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }))
        );
      })
      .catch(() => {});
  };

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

    // Add streaming placeholder
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const url = getSendModelMessageUrl(modelId, activeConvId);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            if (json.content) {
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
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                }
                return next;
              });
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
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (modelLoading) {
    return (
      <div className="min-h-[100dvh] bg-background p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-4 w-72 mb-8" />
        <div className="grid grid-cols-3 gap-6">
          <Skeleton className="h-64 col-span-1" />
          <Skeleton className="h-64 col-span-2" />
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
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{model.name}</h1>
                  <Badge variant={model.enabled ? 'default' : 'secondary'}>
                    {model.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{model.modelId}</p>
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {model.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the model and all its conversations. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex gap-6 min-h-0">
        {/* Sidebar: conversations */}
        <aside className="w-64 shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Conversations</span>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'config')}>
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="chat" className="h-6 px-2 text-xs gap-1">
                  <MessageSquare className="h-3 w-3" /> Chat
                </TabsTrigger>
                <TabsTrigger value="config" className="h-6 px-2 text-xs gap-1">
                  <Settings className="h-3 w-3" /> Config
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2 w-full"
            onClick={handleNewConversation}
            disabled={createConversation.isPending || activeTab === 'config'}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>

          <ScrollArea className="flex-1">
            {convsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-1">
                {[...conversations].reverse().map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                      activeConvId === conv.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => { handleSelectConversation(conv.id); setActiveTab('chat'); }}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-xs truncate">{conv.title}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive"
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

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'chat' | 'config')}>
            <TabsContent value="chat" className="mt-0 h-full">
              {activeConvId ? (
                <div className="flex flex-col h-[calc(100vh-200px)]">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4 pb-4">
                      {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                          <Bot className="h-8 w-8 mb-2" />
                          <p className="text-sm">Send a message to get started</p>
                        </div>
                      )}
                      {messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          <div
                            className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          </div>
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground'
                            }`}
                          >
                            {msg.role === 'user' ? (
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            ) : msg.content ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-pre:my-2 prose-code:text-xs">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {msg.content}
                                </ReactMarkdown>
                                {msg.streaming && (
                                  <span className="inline-block w-0.5 h-3.5 bg-current animate-pulse ml-0.5 align-middle" />
                                )}
                              </div>
                            ) : msg.streaming ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="text-xs opacity-70">Thinking…</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  <div className="shrink-0 pt-4 border-t border-border mt-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isSending}
                        className="resize-none min-h-[44px] max-h-[120px]"
                        rows={1}
                        data-testid="input-message"
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!inputText.trim() || isSending}
                        size="icon"
                        data-testid="button-send"
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
              ) : (
                <Card className="border-dashed border-2 h-[calc(100vh-200px)] flex items-center justify-center">
                  <CardContent className="flex flex-col items-center text-center p-8">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No conversation selected</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      Start a new conversation to test <span className="font-medium">{model.name}</span>
                    </p>
                    <Button onClick={handleNewConversation} disabled={createConversation.isPending}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Chat
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="config" className="mt-0">
              <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                <ModelForm
                  defaultValues={model}
                  onSubmit={handleUpdate}
                  isSubmitting={updateModel.isPending}
                  submitLabel="Save Changes"
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
