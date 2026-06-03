import { Component, ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import SynthApp from "@/pages/synth-app";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Synth ErrorBoundary]', error, info.componentStack);
  }
  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f0f0f', color: '#aaa', gap: 20, fontFamily: 'monospace',
        }}>
          <div style={{ color: '#e87d27', fontWeight: 'bold', fontSize: 13, letterSpacing: '0.15em' }}>
            MODULAR — UNEXPECTED ERROR
          </div>
          <div style={{ fontSize: 11, color: '#555', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
            {error.message}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => this.setState({ error: null })}
              style={{ padding: '7px 18px', background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, color: '#ccc', cursor: 'pointer', fontSize: 11 }}
            >
              Try to recover
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '7px 18px', background: '#161616', border: '1px solid #333', borderRadius: 4, color: '#777', cursor: 'pointer', fontSize: 11 }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={SynthApp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;