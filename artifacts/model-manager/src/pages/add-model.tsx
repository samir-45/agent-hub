import { useLocation } from 'wouter';
import { useCreateModel } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListModelsQueryKey } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { ModelForm } from '@/components/model-form';
import type { ModelInput } from '@workspace/api-client-react';

export default function AddModel() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createModel = useCreateModel();

  const handleSubmit = async (data: ModelInput) => {
    createModel.mutate(
      { data },
      {
        onSuccess: (model) => {
          toast({
            title: 'Model created',
            description: `${model.name} has been configured successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: getListModelsQueryKey() });
          setLocation(`/models/${model.id}`);
        },
        onError: (error: any) => {
          toast({
            title: 'Failed to create model',
            description: error?.message || 'An error occurred',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/">
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-back"
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Add Model
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Configure a new OpenRouter model
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <ModelForm onSubmit={handleSubmit} isSubmitting={createModel.isPending} />
      </div>
    </div>
  );
}
