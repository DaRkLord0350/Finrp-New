import ReportViewerClient from "./ReportViewerClient";

export default async function ReportViewerPage({ params }: {params: Promise<{ slug: string }>;})  {
  const { slug } = await params;
  return <ReportViewerClient slug=  {slug} />;
}
