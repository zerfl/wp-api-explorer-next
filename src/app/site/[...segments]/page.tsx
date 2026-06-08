import ExplorerApp from "@/components/ExplorerApp";

export default async function SiteExplorerPage({
  params,
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  return <ExplorerApp initialPathname={`/site/${segments.join("/")}`} />;
}
