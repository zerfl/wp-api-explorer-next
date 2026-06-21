"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Download, ChevronRight, ChevronDown, Search, FolderClosed, FolderOpen } from "lucide-react";

interface JsonViewerProps {
  data: unknown;
}

export default function JsonViewer({ data }: JsonViewerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wordpress-api-response-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-border/40 rounded-lg bg-background/40 backdrop-blur-md overflow-hidden flex flex-col h-[600px] shadow-sm">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/20 border-b border-border/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setGlobalExpanded(true)}
            className="text-xs h-7 px-2 font-medium"
          >
            Expand All
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setGlobalExpanded(false)}
            className="text-xs h-7 px-2 font-medium"
          >
            Collapse All
          </Button>
        </div>

        <div className="flex flex-1 max-w-sm relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search keys or values..."
            aria-label="Search JSON keys or values"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-7.5 text-xs bg-background/50 border-border/60"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="xs"
            variant="ghost"
            onClick={copyToClipboard}
            className="text-xs h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground font-semibold"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy Raw"}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={downloadJson}
            className="text-xs h-7 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground font-semibold"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed bg-background/20 select-text">
        {data === undefined ? (
          <span className="text-muted-foreground italic">undefined</span>
        ) : (
          <JsonNode
            val={data}
            name="response"
            isLast={true}
            searchQuery={searchQuery}
            globalExpanded={globalExpanded}
            depth={0}
          />
        )}
      </div>
    </div>
  );
}

interface JsonNodeProps {
  val: unknown;
  name: string | number;
  isLast: boolean;
  searchQuery: string;
  globalExpanded: boolean | null;
  depth: number;
}

function JsonNode({ val, name, isLast, searchQuery, globalExpanded, depth }: JsonNodeProps) {
  const [prevGlobalExpanded, setPrevGlobalExpanded] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  if (globalExpanded !== prevGlobalExpanded) {
    setPrevGlobalExpanded(globalExpanded);
    if (globalExpanded !== null) {
      setIsExpanded(globalExpanded);
    }
  }

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/30 text-foreground px-0.5 rounded">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const renderValue = (value: unknown) => {
    if (value === null) return <span className="text-purple-400">null</span>;
    if (typeof value === "boolean") {
      return <span className="text-blue-400">{String(value)}</span>;
    }
    if (typeof value === "number") {
      return <span className="text-orange-400">{highlightText(String(value))}</span>;
    }
    if (typeof value === "string") {
      return <span className="text-green-400">&quot;{highlightText(value)}&quot;</span>;
    }
    return String(value);
  };

  const isObject = val !== null && typeof val === "object";

  if (!isObject) {
    return (
      <div className="hover:bg-foreground/5 py-0.5 px-1 rounded transition-colors pl-6 text-xs">
        <span className="text-foreground/70 mr-1.5">
          {typeof name === "number" ? name : highlightText(String(name))}:
        </span>
        {renderValue(val)}
        {!isLast && <span className="text-foreground/40">,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(val);
  const keys = isArray ? Array.from({ length: (val as unknown[]).length }, (_, i) => i) : Object.keys(val as Record<string, unknown>);
  const isEmpty = keys.length === 0;

  if (isEmpty) {
    return (
      <div className="hover:bg-foreground/5 py-0.5 px-1 rounded pl-6 text-xs">
        <span className="text-foreground/70 mr-1">
          {typeof name === "number" ? name : highlightText(String(name))}:
        </span>
        <span className="text-foreground/50">{isArray ? "[]" : "{}"}</span>
        {!isLast && <span className="text-foreground/40">,</span>}
      </div>
    );
  }

  return (
    <div className="space-y-0.5 text-xs">
      <div className="flex items-center hover:bg-foreground/5 py-0.5 px-1 rounded transition-colors">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${name}`}
          className="mr-1 hover:bg-foreground/10 p-0.5 rounded text-muted-foreground shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        <span
          className="text-foreground/75 cursor-pointer flex items-center gap-1 mr-1.5 font-semibold"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {typeof name === "number" ? name : highlightText(String(name))}:
        </span>
        <span className="text-foreground/50 text-xs select-none flex items-center gap-1">
          {isExpanded ? (
            <>
              {isArray ? <FolderOpen className="h-3.5 w-3.5 inline text-blue-500/80" aria-hidden="true" /> : <FolderOpen className="h-3.5 w-3.5 inline text-purple-500/80" aria-hidden="true" />}
              {isArray ? "Array" : "Object"}{" "}
              <span className="opacity-60">({keys.length} items)</span>
            </>
          ) : (
            <>
              {isArray ? <FolderClosed className="h-3.5 w-3.5 inline text-blue-500/60" aria-hidden="true" /> : <FolderClosed className="h-3.5 w-3.5 inline text-purple-500/60" aria-hidden="true" />}
              {isArray ? `[...]` : `{...}`}{" "}
              <span className="opacity-60">({keys.length} items)</span>
            </>
          )}
        </span>
        {!isLast && !isExpanded && <span className="text-foreground/40">,</span>}
      </div>

      {isExpanded && (
        <div className="border-l border-border/30 pl-4 ml-2.5 transition-all">
          {keys.map((key, i) => (
            <JsonNode
              key={key}
              val={isArray ? (val as unknown[])[key as number] : (val as Record<string, unknown>)[key as string]}
              name={key}
              isLast={i === keys.length - 1}
              searchQuery={searchQuery}
              globalExpanded={globalExpanded}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="pl-6 text-foreground/40">
          {isArray ? "]" : "}"}
          {!isLast && <span>,</span>}
        </div>
      )}
    </div>
  );
}
