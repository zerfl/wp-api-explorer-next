"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Globe, ShieldAlert, KeyRound, Loader2, Sparkles } from "lucide-react";
import { QUICK_CONNECT_SITES, QuickConnectSite } from "@/lib/constants";
import { discoverWpApiRoot, WpSchema } from "@/lib/wp-schema";

interface SiteSelectorProps {
  onConnect: (data: {
    siteUrl: string;
    apiRoot: string;
    schema: WpSchema;
    useProxy: boolean;
    auth: { username: string; appPassword: string } | null;
  }) => void;
  isLoading: boolean;
}

export default function SiteSelector({ onConnect, isLoading }: SiteSelectorProps) {
  const [url, setUrl] = useState("https://techcrunch.com");
  const [useProxy, setUseProxy] = useState(false);
  
  // Auth states
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [appPassword, setAppPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (targetUrl: string, proxyMode: boolean) => {
    setError(null);
    try {
      const authData = showAuth && username && appPassword
        ? { username, appPassword }
        : null;

      const { apiRoot, schema } = await discoverWpApiRoot(targetUrl, proxyMode);
      
      onConnect({
        siteUrl: targetUrl,
        apiRoot,
        schema,
        useProxy: proxyMode,
        auth: authData
      });
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(
        errorMessage || 
        "Failed to discover WordPress REST API. Make sure the site exists, has REST API enabled, and is CORS accessible or use the Proxy option."
      );
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    handleConnect(url, useProxy);
  };

  const handleQuickConnect = (site: QuickConnectSite) => {
    setUrl(site.url);
    setUseProxy(site.defaultProxy);
    handleConnect(site.url, site.defaultProxy);
  };

  return (
    <Card className="border-border bg-card/40 backdrop-blur-md shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Globe className="h-5.5 w-5.5 text-primary animate-pulse" />
          WordPress Site Selector
        </CardTitle>
        <CardDescription className="text-sm">
          Connect to any self-hosted WordPress site or public publication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="site-url" className="text-sm font-semibold">Site URL</Label>
            <div className="flex gap-2">
              <Input
                id="site-url"
                type="text"
                placeholder="e.g. techcrunch.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                className="bg-background/50 text-sm h-10"
              />
              <Button type="submit" disabled={isLoading || !url} className="px-5 h-10 text-sm font-semibold">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Connect
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-background/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 max-w-[80%]">
                <Label htmlFor="use-proxy" className="text-sm font-semibold cursor-pointer">
                  CORS Proxy Mode
                </Label>
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Route requests through local server to bypass browser CORS blocks
                </span>
              </div>
              <Switch
                id="use-proxy"
                checked={useProxy}
                onCheckedChange={setUseProxy}
                disabled={isLoading}
              />
            </div>

            <div className="border-t border-border/40 pt-2.5">
              <button
                type="button"
                onClick={() => setShowAuth(!showAuth)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {showAuth ? "Hide Authentication" : "Add Basic Auth / Application Password"}
              </button>

              {showAuth && (
                <div className="mt-2 grid grid-cols-2 gap-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <Label htmlFor="auth-user" className="text-xs font-medium">Username</Label>
                    <Input
                      id="auth-user"
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-9 text-xs bg-background/50"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="auth-pwd" className="text-xs font-medium">App Password</Label>
                    <Input
                      id="auth-pwd"
                      type="password"
                      placeholder="abcd efgh ijkl mnop"
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      className="h-9 text-xs bg-background/50"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </form>

        <div className="space-y-2 border-t border-border/50 pt-3">
          <Label className="text-xs text-muted-foreground flex items-center gap-1 font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Quick Connect Bookmarks
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_CONNECT_SITES.map((site) => (
              <button
                key={site.name}
                type="button"
                onClick={() => handleQuickConnect(site)}
                disabled={isLoading}
                className="flex flex-col items-start rounded-md border border-border/40 bg-background/40 hover:bg-background/80 p-2.5 text-left transition-colors hover:border-primary/50 disabled:opacity-50"
              >
                <span className="text-xs font-bold text-foreground">{site.name}</span>
                <span className="text-xs text-muted-foreground truncate w-full mt-0.5">
                  {site.url.replace(/^https?:\/\//, "")}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
