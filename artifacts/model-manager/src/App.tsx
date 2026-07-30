import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Sparkles } from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Dashboard from '@/pages/dashboard';
import AddModel from '@/pages/add-model';
import ModelDetail from '@/pages/model-detail';
import Settings from '@/pages/settings';
import ImageStudio from '@/pages/image-studio';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_Zm9uZC1ib2EtODEuY2xlcmsuYWNjb3VudHMuZGV2JA';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthLanding() {
  return (
    <div className="min-h-screen bg-[#060807] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_70%)]" />
      <div className="relative z-10 w-full max-w-md space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-xl glow-primary">
            <Sparkles className="h-7 w-7 text-black stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Agent Hub Cockpit</h1>
          <p className="text-sm text-emerald-400 font-mono">Sign in to access your model manager</p>
        </div>
        <div className="flex justify-center">
          <SignIn />
        </div>
      </div>
    </div>
  );
}

import AdminPage from '@/pages/admin';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/models/new" component={AddModel} />
      <Route path="/models/:id" component={ModelDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/generate" component={ImageStudio} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#10b981',
          colorBackground: '#0d110e',
          colorInputBackground: '#131915',
          colorInputText: '#f3f4f6',
          colorText: '#f3f4f6',
          colorTextSecondary: '#9ca3af',
          borderRadius: '1rem',
        },
        elements: {
          card: 'border border-emerald-500/30 bg-[#0d110e]/95 backdrop-blur-xl shadow-2xl rounded-3xl p-6',
          headerTitle: 'text-white font-extrabold text-lg',
          headerSubtitle: 'text-emerald-400 font-mono text-xs',
          socialButtonsBlockButton: 'bg-card border border-border/60 hover:bg-emerald-500/10 text-white rounded-xl',
          formButtonPrimary: 'gradient-primary text-black font-bold rounded-xl hover:opacity-95 shadow-lg glow-primary',
          footerActionLink: 'text-emerald-400 hover:text-emerald-300 font-bold',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <SignedIn>
              <Router />
            </SignedIn>
            <SignedOut>
              <AuthLanding />
            </SignedOut>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
