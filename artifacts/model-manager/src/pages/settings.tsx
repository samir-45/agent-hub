import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Key, Pencil, Trash2, Plus, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/hooks/use-toast';

type ApiKeyStatus = {
  exists: boolean;
  source: 'database' | 'env' | 'none';
  maskedKey: string | null;
};

const API_KEY_QUERY_KEY = ['settings', 'openrouter-api-key'];

async function fetchApiKeyStatus(): Promise<ApiKeyStatus> {
  const res = await fetch('/api/settings/openrouter-api-key');
  if (!res.ok) throw new Error('Failed to fetch API key status');
  return res.json();
}

async function upsertApiKey(apiKey: string): Promise<{ maskedKey: string }> {
  const res = await fetch('/api/settings/openrouter-api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  if (!res.ok) throw new Error('Failed to save API key');
  return res.json();
}

async function deleteApiKey(): Promise<void> {
  const res = await fetch('/api/settings/openrouter-api-key', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete API key');
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: API_KEY_QUERY_KEY,
    queryFn: fetchApiKeyStatus,
  });

  const saveMutation = useMutation({
    mutationFn: upsertApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_QUERY_KEY });
      setDialogOpen(false);
      setInputKey('');
      setShowKey(false);
      toast({ title: 'API key saved', description: 'Your OpenRouter API key has been encrypted and stored.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_QUERY_KEY });
      toast({ title: 'API key removed', description: 'The stored key has been deleted.' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    },
  });

  const handleOpenDialog = () => {
    setInputKey('');
    setShowKey(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const trimmed = inputKey.trim();
    if (!trimmed) return;
    saveMutation.mutate(trimmed);
  };

  const sourceLabel: Record<ApiKeyStatus['source'], string> = {
    database: 'Stored (encrypted)',
    env: 'Environment variable',
    none: 'Not configured',
  };

  const sourceVariant: Record<ApiKeyStatus['source'], 'default' | 'secondary' | 'destructive'> = {
    database: 'default',
    env: 'secondary',
    none: 'destructive',
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage API keys and configuration</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* OpenRouter API Key Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">OpenRouter API Key</CardTitle>
            </div>
            <CardDescription>
              Used to send requests to OpenRouter models. Stored encrypted in the database using AES-256-GCM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="h-16 rounded-lg bg-muted animate-pulse" />
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border border-border p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${status?.exists ? 'bg-primary/10' : 'bg-muted'}`}>
                      <ShieldCheck className={`h-4 w-4 ${status?.exists ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {status?.maskedKey ?? 'No key configured'}
                        </span>
                        <Badge variant={sourceVariant[status?.source ?? 'none']} className="text-xs">
                          {sourceLabel[status?.source ?? 'none']}
                        </Badge>
                      </div>
                      {status?.source === 'env' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Using environment variable — save a key here to override it
                        </p>
                      )}
                      {status?.source === 'none' && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add a key to start using OpenRouter models
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleOpenDialog}
                      data-testid="button-edit-key"
                    >
                      {status?.exists && status.source === 'database' ? (
                        <><Pencil className="h-3.5 w-3.5" /> Edit</>
                      ) : (
                        <><Plus className="h-3.5 w-3.5" /> Add Key</>
                      )}
                    </Button>

                    {status?.exists && status.source === 'database' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            data-testid="button-delete-key"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove API key?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The stored key will be permanently deleted. The app will fall back to
                              the OPENROUTER_API_KEY environment variable if one is set.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate()}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 border border-border p-3 flex gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>
                    Keys are encrypted with AES-256-GCM before being stored. The raw value is never
                    sent back to the browser — only a masked preview is shown.
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{status?.exists && status.source === 'database' ? 'Edit API Key' : 'Add API Key'}</DialogTitle>
            <DialogDescription>
              Enter your OpenRouter API key. It will be encrypted and stored securely — you can find it at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-primary"
              >
                openrouter.ai/keys
              </a>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="api-key-input">API Key</Label>
            <div className="relative">
              <Input
                id="api-key-input"
                data-testid="input-api-key"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-v1-..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="pr-10 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey((v) => !v)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!inputKey.trim() || saveMutation.isPending}
              data-testid="button-save-key"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
