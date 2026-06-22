import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";

function Placeholder() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">HermesHub — ARD Work Board</h1>
      <p className="max-w-md text-muted-foreground">
        The ARD-compatible agent work board is being rebuilt. The schema, capability
        taxonomy, and settlement libraries are in place; the UI ships in a later phase.
      </p>
    </main>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Placeholder} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
