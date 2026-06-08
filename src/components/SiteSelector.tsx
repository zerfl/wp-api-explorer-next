"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Globe, KeyRound, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { QUICK_CONNECT_SITES, QuickConnectSite } from "@/lib/constants";

interface SiteSelectorProps {
  connectionError: string | null;
  currentSiteUrl?: string | null;
  hideExamples?: boolean;
  isLoading: boolean;
  onConnect: (data: {
    siteUrl: string;
    useProxy: boolean;
    auth: { username: string; appPassword: string } | null;
  }) => void;
}

export default function SiteSelector({
  connectionError,
  currentSiteUrl,
  hideExamples = false,
  isLoading,
  onConnect,
}: SiteSelectorProps) {
  const [url, setUrl] = useState(currentSiteUrl || "https://techcrunch.com");
  const [useProxy, setUseProxy] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");

  const submitConnect = (targetUrl: string, proxyMode: boolean) => {
    const auth =
      showAuth && username.trim() && appPassword.trim()
        ? {
            username: username.trim(),
            appPassword: appPassword.trim(),
          }
        : null;

    onConnect({
      siteUrl: targetUrl,
      useProxy: proxyMode,
      auth,
    });
  };

  const handleQuickConnect = (site: QuickConnectSite) => {
    setUrl(site.url);
    setUseProxy(false);
    submitConnect(site.url, false);
  };

  return (
    <div className="w-full space-y-2">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!url.trim()) {
            return;
          }

          submitConnect(url, useProxy);
        }}
        className="space-y-2"
      >
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="site-url" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Site URL
            </Label>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="site-url"
                type="text"
                placeholder="example.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isLoading}
                className="h-10 bg-background/70 pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex min-w-[170px] items-end">
            <div className="flex h-10 w-full items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3">
              <div className="min-w-0">
                <Label htmlFor="use-proxy" className="cursor-pointer text-sm font-semibold">
                  Proxy
                </Label>
                <p className="truncate text-xs text-muted-foreground">Bypass browser CORS limits</p>
              </div>
              <Switch
                id="use-proxy"
                checked={useProxy}
                onCheckedChange={setUseProxy}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="h-10 w-full min-w-[118px] text-sm font-semibold xl:w-auto"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/25 p-2.5 lg:flex-row lg:items-center lg:justify-between">
          <button
            type="button"
            onClick={() => setShowAuth((current) => !current)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <KeyRound className="h-4 w-4" />
            {showAuth ? "Hide authentication" : "Add basic auth / application password"}
          </button>

          {showAuth ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px] lg:flex-1">
              <Input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-10 bg-background/60 text-sm"
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder="App password"
                value={appPassword}
                onChange={(event) => setAppPassword(event.target.value)}
                className="h-10 bg-background/60 text-sm"
                disabled={isLoading}
              />
            </div>
          ) : null}
        </div>

        {connectionError ? (
          <div className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{connectionError}</span>
          </div>
        ) : null}
      </form>

      {!hideExamples ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Examples
          </span>
          {QUICK_CONNECT_SITES.map((site) => (
            <Button
              key={site.name}
              type="button"
              variant="outline"
              onClick={() => handleQuickConnect(site)}
              disabled={isLoading}
              className="h-7 text-sm"
              title={site.description}
            >
              {site.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
