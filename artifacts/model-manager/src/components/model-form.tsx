import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ModelInput, Model } from '@workspace/api-client-react';

const modelFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  modelId: z.string().min(1, 'Model ID is required'),
  description: z.string().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(200000),
  systemPrompt: z.string().optional(),
  topP: z.number().min(0).max(1),
  enabled: z.boolean(),
});

type ModelFormValues = z.infer<typeof modelFormSchema>;

interface ModelFormProps {
  defaultValues?: Partial<Model>;
  onSubmit: (data: ModelInput) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function ModelForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = 'Save',
}: ModelFormProps) {
  const form = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      modelId: defaultValues?.modelId ?? '',
      description: defaultValues?.description ?? '',
      temperature: defaultValues?.temperature ?? 0.7,
      maxTokens: defaultValues?.maxTokens ?? 8192,
      systemPrompt: defaultValues?.systemPrompt ?? '',
      topP: defaultValues?.topP ?? 1.0,
      enabled: defaultValues?.enabled ?? true,
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit({
      name: values.name,
      modelId: values.modelId,
      description: values.description || undefined,
      temperature: values.temperature,
      maxTokens: values.maxTokens,
      systemPrompt: values.systemPrompt || undefined,
      topP: values.topP,
      enabled: values.enabled,
    });
  });

  const temperature = form.watch('temperature');
  const topP = form.watch('topP');
  const maxTokens = form.watch('maxTokens');

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>How this model configuration is identified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                data-testid="input-name"
                placeholder="e.g. GPT-4 Creative"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelId">OpenRouter Model ID</Label>
              <Input
                id="modelId"
                data-testid="input-model-id"
                placeholder="e.g. openai/gpt-4o"
                className="font-mono text-sm"
                {...form.register('modelId')}
              />
              {form.formState.errors.modelId && (
                <p className="text-xs text-destructive">{form.formState.errors.modelId.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              data-testid="input-description"
              placeholder="Optional — what is this configuration for?"
              {...form.register('description')}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enabled" className="text-sm font-medium">Enabled</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Make this model available for use</p>
            </div>
            <Switch
              id="enabled"
              data-testid="switch-enabled"
              checked={form.watch('enabled')}
              onCheckedChange={(val) => form.setValue('enabled', val)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">System Prompt</CardTitle>
          <CardDescription>Instructions sent to the model before every conversation</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="systemPrompt"
            data-testid="textarea-system-prompt"
            placeholder="You are a helpful assistant..."
            className="font-mono text-sm min-h-[120px] resize-y"
            {...form.register('systemPrompt')}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sampling Parameters</CardTitle>
          <CardDescription>Control how the model generates responses</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm font-mono text-muted-foreground">{temperature.toFixed(2)}</span>
            </div>
            <Slider
              data-testid="slider-temperature"
              min={0}
              max={2}
              step={0.01}
              value={[temperature]}
              onValueChange={([val]) => form.setValue('temperature', val)}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more focused and deterministic · Higher = more creative and random
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Top P</Label>
              <span className="text-sm font-mono text-muted-foreground">{topP.toFixed(2)}</span>
            </div>
            <Slider
              data-testid="slider-top-p"
              min={0}
              max={1}
              step={0.01}
              value={[topP]}
              onValueChange={([val]) => form.setValue('topP', val)}
            />
            <p className="text-xs text-muted-foreground">
              Nucleus sampling — 1.0 considers all tokens, lower values cut off low-probability tokens
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <span className="text-sm font-mono text-muted-foreground">{maxTokens.toLocaleString()}</span>
            </div>
            <Input
              id="maxTokens"
              data-testid="input-max-tokens"
              type="number"
              min={1}
              max={200000}
              {...form.register('maxTokens', { valueAsNumber: true })}
            />
            {form.formState.errors.maxTokens && (
              <p className="text-xs text-destructive">{form.formState.errors.maxTokens.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          data-testid="button-submit"
          disabled={isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
