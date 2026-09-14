import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ReportWizard } from "@/components/ReportWizard";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return <ReportWizard reportId={id} />;
}
