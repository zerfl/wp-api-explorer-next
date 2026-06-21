"use client";

import { memo } from "react";
import { QUICK_CONNECT_SITES } from "@/lib/constants";
import { useExplorer } from "@/contexts/ExplorerContext";
import { useRequest } from "@/contexts/RequestContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Image as ImageIcon, Sparkles, Terminal } from "lucide-react";

function DisconnectedHeroComponent() {
  const {
    actions: { connectToSite },
    meta: { bookmarkContentType },
  } = useExplorer();
  const {
    state: { isLoading },
  } = useRequest();

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <div className="max-w-3xl text-center">
        <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 shadow-inner">
          <Database className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Client-side WordPress Explorer
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect to any WordPress site, browse bookmarkable collection URLs, inspect media properly,
          and keep your preferred page size across sessions.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="space-y-2 p-5">
              <Sparkles className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-base font-semibold">Bookmarkable collections</h3>
              <p className="text-sm text-muted-foreground">
                Share direct paths such as `/site/example.com/media/2` and reconnect automatically.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="space-y-2 p-5">
              <Terminal className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-base font-semibold">Proxy when needed</h3>
              <p className="text-sm text-muted-foreground">
                Keep direct requests by default and route through the local proxy only when CORS blocks you.
              </p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card/30 backdrop-blur-sm">
            <CardContent className="space-y-2 p-5">
              <ImageIcon className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-base font-semibold">Better media browsing</h3>
              <p className="text-sm text-muted-foreground">
                Preview images, video, audio, PDFs, and files with gallery navigation inside the modal.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Try an example
          </span>
          {QUICK_CONNECT_SITES.map((site) => (
            <Button
              key={site.name}
              type="button"
              variant="outline"
              onClick={() => {
                void connectToSite({
                  siteUrl: site.url,
                  useProxy: site.defaultProxy,
                  auth: null,
                  desiredContentType: bookmarkContentType || undefined,
                  desiredPage: "1",
                  navigationMode: "replace",
                });
              }}
              disabled={isLoading}
              className="h-8 text-sm"
              title={site.description}
            >
              {site.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

const DisconnectedHero = memo(DisconnectedHeroComponent);

export default DisconnectedHero;
