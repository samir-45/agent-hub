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
  webSearchEnabled: z.boolean(),
});

type ModelFormValues = z.infer<typeof modelFormSchema>;

interface ModelFormProps {
  defaultValues?: Partial<Model>;
  onSubmit: (data: ModelInput) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const FREE_PRESETS = [
  { name: 'Llama 3.3 70B Instruct (Free)', modelId: 'meta-llama/llama-3.3-70b-instruct:free', description: "Meta's flagship 70B open weight model with 128k context window." },
  { name: 'Gemini 2.0 Flash Exp (Free)', modelId: 'google/gemini-2.0-flash-exp:free', description: "Google's next-gen Gemini 2.0 Flash model. Ultra fast speed & multimodal." },
  { name: 'DeepSeek R1 (Free)', modelId: 'deepseek/deepseek-r1:free', description: "DeepSeek's flagship open-weights reasoning model with chain-of-thought." },
  { name: 'DeepSeek V3 (Free)', modelId: 'deepseek/deepseek-chat:free', description: "DeepSeek V3 671B mixture-of-experts model. Exceptional coding & math." },
  { name: 'Qwen 2.5 Coder 32B (Free)', modelId: 'qwen/qwen-2.5-coder-32b-instruct:free', description: "Alibaba's elite 32B coding model optimized for code generation & debugging." },
  { name: 'NVIDIA Nemotron 3 Ultra (Free)', modelId: 'nvidia/nemotron-3-ultra:free', description: "NVIDIA's high-throughput model tuned for instruction following & chat." },
  { name: 'Mistral 7B Instruct (Free)', modelId: 'mistralai/mistral-7b-instruct:free', description: "Mistral's fast and efficient 7B instruct model." },
  { name: 'Phi-3 Medium 128k (Free)', modelId: 'microsoft/phi-3-medium-128k-instruct:free', description: "Microsoft's 14B compact model with 128k context support." },
  { name: 'Gemma 2 9B IT (Free)', modelId: 'google/gemma-2-9b-it:free', description: "Google's Gemma 2 9B instruction-tuned model." },
  { name: 'OpenChat 7B (Free)', modelId: 'openchat/openchat-7b:free', description: "OpenChat 7B tuned with C-RLFT for ChatGPT-like conversational quality." },
];

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
      webSearchEnabled: defaultValues?.webSearchEnabled ?? false,
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
      webSearchEnabled: values.webSearchEnabled,
    });
  });

  const temperature = form.watch('temperature');
  const topP = form.watch('topP');
  const maxTokens = form.watch('maxTokens');

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = FREE_PRESETS.find((p) => p.modelId === e.target.value);
    if (preset) {
      form.setValue('name', preset.name);
      form.setValue('modelId', preset.modelId);
      form.setValue('description', preset.description);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="glass-card rounded-2xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Identity</CardTitle>
              <CardDescription>How this model configuration is identified</CardDescription>
            </div>
            {!defaultValues?.id && (
              <div className="shrink-0">
                <select
                  onChange={handleSelectPreset}
                  className="text-xs bg-muted/60 border border-emerald-500/30 text-emerald-400 font-medium rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 cursor-pointer"
                >
                  <option value="">✨ Quick Fill Free Model…</option>
                  {FREE_PRESETS.map((p) => (
                    <option key={p.modelId} value={p.modelId} className="bg-card text-foreground">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
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
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="webSearchEnabled" className="text-sm font-medium">Web Search</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Let the model search the web via Tavily when needed</p>
            </div>
            <Switch
              id="webSearchEnabled"
              data-testid="switch-web-search"
              checked={form.watch('webSearchEnabled')}
              onCheckedChange={(val) => form.setValue('webSearchEnabled', val)}
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
