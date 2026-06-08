"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Check, Terminal, Code2, Info, Timer, Files, Layers } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RequestConsoleProps {
  method: string;
  targetUrl: string;
  useProxy: boolean;
  auth: { username: string; appPassword: string } | null;
  isLoading: boolean;
  onTriggerRequest: () => void;
  metrics: {
    status: number | null;
    statusText: string;
    timeMs: number | null;
    totalRecords: number | null;
    totalPages: number | null;
  } | null;
}

export default function RequestConsole({
  method,
  targetUrl,
  useProxy,
  auth,
  isLoading,
  onTriggerRequest,
  metrics,
}: RequestConsoleProps) {
  const [copied, setCopied] = useState(false);

  // Generate curl snippet
  const curlCommand = useMemo(() => {
    let cmd = `curl -X ${method} "${targetUrl}"`;
    if (auth) {
      const basic = btoa(`${auth.username}:${auth.appPassword}`);
      cmd += ` \\\n  -H "Authorization: Basic ${basic}"`;
    }
    return cmd;
  }, [method, targetUrl, auth]);

  // Generate js fetch snippet
  const jsFetchCode = useMemo(() => {
    const headersObj: Record<string, string> = {};
    if (auth) {
      const basic = btoa(`${auth.username}:${auth.appPassword}`);
      headersObj["Authorization"] = `Basic ${basic}`;
    }

    const headersStr = Object.keys(headersObj).length > 0
      ? `,\n  headers: ${JSON.stringify(headersObj, null, 4).replace(/\n/g, "\n  ")}`
      : "";

    return `fetch("${targetUrl}"${headersStr ? `,\n  {\n    method: "${method}"${headersStr}\n  }` : ""})
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));`;
  }, [method, targetUrl, auth]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card/25 border border-border/40 rounded-lg p-4 backdrop-blur-md shadow-md space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-background/50 p-3 rounded-lg border border-border/30">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs uppercase font-bold text-primary border-primary/30 bg-primary/5">
              {method}
            </Badge>
            <span className="text-sm text-muted-foreground font-mono truncate block">
              {targetUrl}
            </span>
          </div>
          {useProxy && (
            <p className="text-xs text-primary/80 font-medium">
              → Proxied via local server route: <code className="text-foreground/80">/api/proxy?url=...</code>
            </p>
          )}
        </div>
        <Button
          onClick={onTriggerRequest}
          disabled={isLoading || !targetUrl}
          className="w-full md:w-auto shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5 h-10 shadow-md transition-all active:scale-95 text-sm"
        >
          <Play className="mr-1.5 h-4 w-4 fill-current" />
          Send Request
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Status Metric */}
          <div className="rounded-lg border border-border/40 bg-background/30 p-2.5 flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
              metrics.status && metrics.status >= 200 && metrics.status < 300
                ? "bg-green-500/10 text-green-500"
                : "bg-destructive/10 text-destructive"
            }`}>
              <Info className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</span>
              <span className="text-sm font-bold truncate block">
                {metrics.status} {metrics.statusText}
              </span>
            </div>
          </div>

          {/* Time Metric */}
          <div className="rounded-lg border border-border/40 bg-background/30 p-2.5 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0">
              <Timer className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Latency</span>
              <span className="text-sm font-bold truncate block">
                {metrics.timeMs !== null ? `${metrics.timeMs}ms` : "--"}
              </span>
            </div>
          </div>

          {/* Total Records Metric */}
          <div className="rounded-lg border border-border/40 bg-background/30 p-2.5 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Files className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Items</span>
              <span className="text-sm font-bold truncate block">
                {metrics.totalRecords !== null ? metrics.totalRecords.toLocaleString() : "N/A"}
              </span>
            </div>
          </div>

          {/* Total Pages Metric */}
          <div className="rounded-lg border border-border/40 bg-background/30 p-2.5 flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Pages</span>
              <span className="text-sm font-bold truncate block">
                {metrics.totalPages !== null ? metrics.totalPages.toLocaleString() : "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="curl" className="w-full">
        <div className="flex items-center justify-between border-b border-border/20 pb-1.5 mb-2">
          <TabsList className="bg-background/40 h-8.5 p-0.5 border border-border/30 rounded-md">
            <TabsTrigger value="curl" className="text-xs py-1">
              <Terminal className="h-3 w-3 mr-1" /> cURL
            </TabsTrigger>
            <TabsTrigger value="fetch" className="text-xs py-1">
              <Code2 className="h-3 w-3 mr-1" /> JS Fetch
            </TabsTrigger>
          </TabsList>

          <Button
            size="xs"
            variant="ghost"
            className="h-7 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              const activeTab = document.querySelector('[data-state="active"][role="tab"]') as HTMLElement;
              const activeValue = activeTab?.getAttribute("data-value");
              copyToClipboard(activeValue === "fetch" ? jsFetchCode : curlCommand);
            }}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1 text-green-500" /> Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy Snippet
              </>
            )}
          </Button>
        </div>

        <TabsContent value="curl">
          <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border/40 overflow-x-auto text-muted-foreground leading-relaxed">
            {curlCommand}
          </pre>
        </TabsContent>
        <TabsContent value="fetch">
          <pre className="text-xs font-mono bg-background p-3 rounded-lg border border-border/40 overflow-x-auto text-muted-foreground leading-relaxed">
            {jsFetchCode}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
