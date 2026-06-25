"use client";

import ExplorerProvider from "@/components/ExplorerProvider";
import ExplorerHeader from "@/components/ExplorerHeader";
import CollectionSidebar from "@/components/CollectionSidebar";
import ContentExplorer from "@/components/ContentExplorer";
import DisconnectedHero from "@/components/DisconnectedHero";
import { useExplorer } from "@/contexts/ExplorerContext";

export default function ExplorerApp() {
  return (
    <ExplorerProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-base focus-visible:font-semibold focus-visible:text-primary-foreground focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Skip to content
        </a>
        <ExplorerHeader />
        <ExplorerAppLayout />
      </div>
    </ExplorerProvider>
  );
}

function ExplorerAppLayout() {
  const {
    state: { connection },
  } = useExplorer();

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-h-0 flex-1">
      <CollectionSidebar />
      <main
        id="main-content"
        tabIndex={-1}
        className="min-w-0 flex-1 overflow-y-auto bg-background/25 px-4 py-5 outline-none md:px-6"
      >
        {connection ? <ContentExplorer /> : <DisconnectedHero />}
      </main>
    </div>
  );
}
