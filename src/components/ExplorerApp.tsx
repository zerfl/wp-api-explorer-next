"use client";

import ExplorerProvider from "@/components/ExplorerProvider";
import ExplorerHeader from "@/components/ExplorerHeader";
import CollectionSidebar from "@/components/CollectionSidebar";
import ContentExplorer from "@/components/ContentExplorer";
import DisconnectedHero from "@/components/DisconnectedHero";
import { useExplorer } from "@/contexts/ExplorerContext";

interface ExplorerAppProps {
  initialPathname?: string;
}

export default function ExplorerApp({ initialPathname = "/" }: ExplorerAppProps) {
  return (
    <ExplorerProvider initialPathname={initialPathname}>
      <div className="flex min-h-screen flex-col bg-background">
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
      <main className="min-w-0 flex-1 overflow-y-auto bg-background/25 px-4 py-5 md:px-6">
        {connection ? <ContentExplorer /> : <DisconnectedHero />}
      </main>
    </div>
  );
}
