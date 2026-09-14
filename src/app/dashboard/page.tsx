import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AccountMenu } from "@/components/AccountMenu";
import { Button, Card, Badge } from "@/components/ui/primitives";

const STATUS_LABELS: Record<string, string> = {
  INSTELLINGEN: "Instellingen",
  BRONNEN: "Broninformatie",
  AI_ANALYSE: "AI-analyse",
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
        <div>
          <h1 className="text-2xl font-bold text-vera-800">V.E.R.A.</h1>
          <p className="text-sm text-gray-500">Verslag- en Rapportage Assistent</p>
        </div>
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
            <Link key={report.id} href={`/reports/${report.id}`} className="block">
              <Card className="transition hover:border-vera-300 hover:shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800">{report.title}</div>
                    <div className="text-xs text-gray-500">
                      {report.formatTemplate.documentType.name} — {report.formatTemplate.name}
                    </div>
                  </div>
                  <Badge variant={report.status === "GEEXPORTEERD" ? "success" : "neutral"}>
                    {STATUS_LABELS[report.status] ?? report.status}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
