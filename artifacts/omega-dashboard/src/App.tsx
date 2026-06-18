// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f14] text-white">
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-primary">ProxhqVPN</div>
          <div className="text-white/40 text-sm">© Alpha Unlimited Technologies LLC</div>
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
