"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an analytics or reporting service
    console.error("Rendering crash caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex-grow flex items-center justify-center p-6 bg-background text-foreground">
      <div className="max-w-md w-full border border-border/60 bg-card/30 backdrop-blur-md rounded-xl p-6 shadow-xl text-center space-y-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15 text-destructive border border-destructive/25">
          <ShieldAlert className="h-6 w-6" />
        </div>
        
        <div className="space-y-1.5">
          <h2 className="text-base font-bold tracking-tight">Something went wrong</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            An unexpected error occurred while rendering this view. This has been logged for debugging.
          </p>
        </div>

        {error.message && (
          <pre className="text-[10px] font-mono bg-destructive/5 text-destructive/90 p-3 rounded-lg border border-destructive/15 overflow-x-auto text-left leading-relaxed">
            {error.message}
          </pre>
        )}

        <Button
          onClick={() => reset()}
          className="w-full gap-1.5 h-10 font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload Application
        </Button>
      </div>
    </div>
  );
}
