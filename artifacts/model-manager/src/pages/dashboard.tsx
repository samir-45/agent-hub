import { useState } from 'react';
import { Link } from 'wouter';
import { useGetStats, useListModels } from '@workspace/api-client-react';
import { Activity, Plus, Zap, MessageSquare, Database, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: models, isLoading: modelsLoading } = useListModels();

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Model Manager
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-mono">
                OpenRouter Configuration Cockpit
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/settings">
                <Button variant="ghost" size="icon" data-testid="button-settings" title="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/models/new">
                <Button data-testid="button-add-model" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Model
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Database className="h-5 w-5" />}
            label="Total Models"
            value={stats?.totalModels}
            loading={statsLoading}
            testId="stat-total-models"
          />
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            label="Enabled Models"
            value={stats?.enabledModels}
            loading={statsLoading}
            testId="stat-enabled-models"
            highlight
          />
          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Conversations"
            value={stats?.totalConversations}
            loading={statsLoading}
            testId="stat-total-conversations"
          />
          <StatCard
            icon={<MessageSquare className="h-5 w-5" />}
            label="Messages"
            value={stats?.totalMessages}
            loading={statsLoading}
            testId="stat-total-messages"
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Configured Models
          </h2>
          {modelsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="border-card-border">
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
          ) : models && models.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models.map((model) => (
                <Link key={model.id} href={`/models/${model.id}`}>
                  <Card
                    data-testid={`card-model-${model.id}`}
                    className="border-card-border hover:border-primary transition-all duration-200 cursor-pointer group"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {model.name}
                          </h3>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                            {model.modelId}
                          </p>
                        </div>
                        <Badge
                          variant={model.enabled ? 'default' : 'secondary'}
                          className="ml-2 shrink-0"
                        >
                          {model.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      {model.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {model.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Temp:</span>
                          <span className="font-mono font-medium text-foreground">
                            {model.temperature.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Max:</span>
                          <span className="font-mono font-medium text-foreground">
                            {model.maxTokens}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Top-P:</span>
                          <span className="font-mono font-medium text-foreground">
                            {model.topP.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Database className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No models configured</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                  Add your first OpenRouter model to start testing AI completions
                </p>
                <Link href="/models/new">
                  <Button data-testid="button-add-first-model">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Model
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
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
  highlight?: boolean;
}) {
  return (
    <Card className={`border-card-border ${highlight ? 'bg-primary/5' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              highlight
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-7 w-16 mt-1" />
            ) : (
              <p
                data-testid={testId}
                className={`text-2xl font-bold font-mono mt-0.5 ${
                  highlight ? 'text-primary' : 'text-foreground'
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
