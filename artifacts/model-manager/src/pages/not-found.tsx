import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background noise-bg p-4">
      <Card className="w-full max-w-md glass-card rounded-2xl animate-scale-in">
        <CardContent className="pt-6 text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1">
            404 — Page Not Found
          </h1>
          <p className="text-xs text-muted-foreground mb-6">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <Button className="rounded-xl gradient-primary text-black font-semibold border-0 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
