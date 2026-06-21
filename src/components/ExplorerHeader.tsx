"use client";

import React, { memo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useExplorer } from "@/contexts/ExplorerContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  ChevronDown,
  ExternalLink,
  Globe,
  KeyRound,
  Laptop,
  Loader2,
  Moon,
  Settings,
  ShieldAlert,
  Sun,
  Unlink,
} from "lucide-react";

function ExplorerHeaderComponent() {
  const {
    state: { connection, selectedRoute, isAdvancedMode, isConnecting, connectionError },
    actions: { connectToSite, disconnect, setAdvancedMode },
    meta: { selectedCollection, suggestedSiteUrl, bookmarkContentType },
  } = useExplorer();
  const {
    state: { theme },
    actions: { setTheme },
  } = useTheme();

  const headerStateKey = [
    suggestedSiteUrl || "https://techcrunch.com",
    connection?.useProxy ? "proxy" : "direct",
    connection?.auth?.username || "",
    connection?.auth?.appPassword || "",
  ].join("::");

  return (
    <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 px-4 md:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
            <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <h1 className="hidden text-base font-bold tracking-tight text-foreground sm:block">
            WP Explorer
          </h1>
        </div>

        <HeaderConnectionControls
          key={headerStateKey}
          connection={connection}
          isConnecting={isConnecting}
          isAdvancedMode={isAdvancedMode}
          selectedRoutePath={selectedRoute?.path}
          selectedContentType={selectedCollection?.slug || bookmarkContentType || undefined}
          initialUrl={suggestedSiteUrl || "https://techcrunch.com"}
          initialUseProxy={connection?.useProxy || false}
          initialUsername={connection?.auth?.username || ""}
          initialAppPassword={connection?.auth?.appPassword || ""}
          initialShowAuth={Boolean(connection?.auth)}
          onConnect={connectToSite}
          onDisconnect={disconnect}
          onAdvancedModeChange={setAdvancedMode}
        />

        <div
          role="group"
          aria-label="Color theme"
          className="flex shrink-0 items-center rounded-lg border border-border/50 bg-background/50 p-0.5"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme("light")}
            className={`h-7 w-7 ${theme === "light" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            aria-label="Light mode"
            aria-pressed={theme === "light"}
          >
            <Sun className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme("system")}
            className={`h-7 w-7 ${theme === "system" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            aria-label="System theme"
            aria-pressed={theme === "system"}
          >
            <Laptop className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme("dark")}
            className={`h-7 w-7 ${theme === "dark" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`}
            aria-label="Dark mode"
            aria-pressed={theme === "dark"}
          >
            <Moon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {connectionError ? (
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-2 md:px-6">
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-2.5 text-sm text-destructive"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{connectionError}</span>
          </div>
        </div>
      ) : null}
    </header>
  );
}

interface HeaderConnectionControlsProps {
  connection: ReturnType<typeof useExplorer>["state"]["connection"];
  isConnecting: boolean;
  isAdvancedMode: boolean;
  selectedRoutePath?: string;
  selectedContentType?: string;
  initialUrl: string;
  initialUseProxy: boolean;
  initialUsername: string;
  initialAppPassword: string;
  initialShowAuth: boolean;
  onConnect: ReturnType<typeof useExplorer>["actions"]["connectToSite"];
  onDisconnect: ReturnType<typeof useExplorer>["actions"]["disconnect"];
  onAdvancedModeChange: ReturnType<typeof useExplorer>["actions"]["setAdvancedMode"];
}

function HeaderConnectionControls({
  connection,
  isConnecting,
  isAdvancedMode,
  selectedRoutePath,
  selectedContentType,
  initialUrl,
  initialUseProxy,
  initialUsername,
  initialAppPassword,
  initialShowAuth,
  onConnect,
  onDisconnect,
  onAdvancedModeChange,
}: HeaderConnectionControlsProps) {
  const [headerUrl, setHeaderUrl] = useState(initialUrl);
  const [headerUseProxy, setHeaderUseProxy] = useState(initialUseProxy);
  const [headerShowAuth, setHeaderShowAuth] = useState(initialShowAuth);
  const [headerUsername, setHeaderUsername] = useState(initialUsername);
  const [headerAppPassword, setHeaderAppPassword] = useState(initialAppPassword);

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!headerUrl.trim()) {
            return;
          }

          const auth =
            headerShowAuth && headerUsername.trim() && headerAppPassword.trim()
              ? { username: headerUsername.trim(), appPassword: headerAppPassword.trim() }
              : null;

          void onConnect({
            siteUrl: headerUrl,
            useProxy: headerUseProxy,
            auth,
            desiredContentType: selectedContentType,
            desiredPage: "1",
            desiredRoutePath: isAdvancedMode ? selectedRoutePath : undefined,
            navigationMode: "replace",
          });
        }}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Globe
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="header-site-url"
            type="text"
            placeholder="wordpress-site.com"
            aria-label="WordPress site URL"
            value={headerUrl}
            onChange={(event) => setHeaderUrl(event.target.value)}
            disabled={isConnecting}
            className="h-9 bg-background/70 pl-8 text-sm"
          />
        </div>

        {connection ? (
          <Popover>
            <PopoverTrigger
              aria-label="Connection details"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <span className="hidden max-w-[140px] truncate sm:inline">
                {connection.schema.name || "Connected"}
              </span>
              <span className="sm:hidden">Connected</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="w-72 space-y-3 p-3">
              <div className="space-y-1.5">
                <div className="text-sm font-semibold text-foreground">
                  {connection.schema.name || "WordPress Site"}
                </div>
                <div className="break-all font-mono text-xs text-muted-foreground">
                  {connection.apiRoot}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={connection.schema.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
                >
                  Open site
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="border-t border-border/30 pt-2">
                <Button
                  variant="outline"
                  onClick={onDisconnect}
                  className="h-9 w-full gap-1.5 text-sm text-muted-foreground hover:border-destructive/30 hover:text-destructive"
                >
                  <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                  Disconnect
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            type="submit"
            disabled={isConnecting || !headerUrl.trim()}
            className="h-9 shrink-0 gap-1.5 text-sm font-semibold"
          >
            {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Connect
          </Button>
        )}
      </form>

      <Popover>
        <PopoverTrigger
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Connection settings"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 space-y-3 p-3">
          <div className="text-sm font-semibold text-foreground">Connection settings</div>

          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
            <div className="min-w-0">
              <Label htmlFor="settings-proxy" className="cursor-pointer text-sm font-semibold">
                Proxy
              </Label>
              <p className="text-xs text-muted-foreground">Bypass browser CORS limits</p>
            </div>
            <Switch
              id="settings-proxy"
              checked={headerUseProxy}
              onCheckedChange={setHeaderUseProxy}
              disabled={isConnecting}
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setHeaderShowAuth((current) => !current)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {headerShowAuth ? "Hide authentication" : "Add basic auth"}
            </button>
            {headerShowAuth ? (
              <div className="grid gap-2">
                <Input
                  type="text"
                  placeholder="Username"
                  value={headerUsername}
                  onChange={(event) => setHeaderUsername(event.target.value)}
                  className="h-9 bg-background/60 text-sm"
                  disabled={isConnecting}
                />
                <Input
                  type="password"
                  placeholder="App password"
                  value={headerAppPassword}
                  onChange={(event) => setHeaderAppPassword(event.target.value)}
                  className="h-9 bg-background/60 text-sm"
                  disabled={isConnecting}
                />
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-border/30 pt-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Advanced mode</div>
              <p className="text-xs text-muted-foreground">Full route & query builder</p>
            </div>
            <Switch checked={isAdvancedMode} onCheckedChange={onAdvancedModeChange} />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

const ExplorerHeader = memo(ExplorerHeaderComponent);

export default ExplorerHeader;
