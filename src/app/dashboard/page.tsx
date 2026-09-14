import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AccountMenu } from "@/components/AccountMenu";
import { ReportListItem } from "@/components/ReportListItem";
import { Button, Card } from "@/components/ui/primitives";

const STATUS_LABELS: Record<string, string> = {
  INSTELLINGEN: "Instellingen",
  BRONNEN: "Broninformatie",
  AI_ANALYSE: "VERA-analyse",
  CONTROLE: "Controle en bewerking",
  GEEXPORTEERD: "Geëxporteerd",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user, reports] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, include: { organization: true } }),
    prisma.report.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" },
      include: { formatTemplate: { include: { documentType: true } } },
    }),
  ]);

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Image
          src="/logo.png"
          alt="V.E.R.A. — Verslag- en Rapportage Assistent"
          width={900}
          height={303}
          priority
          className="h-10 w-auto"
        />
        <AccountMenu userName={user.name} organizationName={user.organization.name} />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Mijn rapporten</h2>
        <Link href="/reports/new">
          <Button>+ Nieuw rapport</Button>
        </Link>
      </div>

      {reports.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">
            Je hebt nog geen rapporten. Klik op &quot;+ Nieuw rapport&quot; om te beginnen.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportListItem
              key={report.id}
              reportId={report.id}
              title={report.title}
              reference={report.reference}
              documentTypeName={report.formatTemplate.documentType.name}
              formatName={report.formatTemplate.name}
              statusLabel={STATUS_LABELS[report.status] ?? report.status}
              statusVariant={report.status === "GEEXPORTEERD" ? "success" : "neutral"}
            />
          ))}
        </div>
      )}
    </main>
  );
}
