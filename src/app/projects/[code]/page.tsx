import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRub, formatMonth } from "@/lib/format";
import { distinctMonths } from "@/lib/metrics";
import RevenueTrendChart, { type TrendPoint } from "@/components/RevenueTrendChart";
import RenameProjectForm from "@/components/RenameProjectForm";
import YandexMapsCard from "@/components/YandexMapsCard";

export const dynamic = "force-dynamic";

const RECENT_REVIEWS_ON_PAGE = 5;

export default async function ProjectPage({ params }: { params: { code: string } }) {
  console.log("[diag-code]", JSON.stringify(params.code), params.code.length, Buffer.from(params.code, "utf8").toString("hex"));
  const project = await prisma.project.findUnique({
    where: { code: params.code },
    include: {
      metrics: true,
      yandexMapsInfo: true,
      yandexReviews: { orderBy: { publishedAt: "desc" }, take: RECENT_REVIEWS_ON_PAGE },
    },
  });
  if (!project) notFound();

  const months = distinctMonths(project.metrics);
  const trendData: TrendPoint[] = months.map((month) => ({
    month: formatMonth(month),
    Выручка: project.metrics.find((m) => m.line === "Выручка" && m.month === month)?.value ?? 0,
    "Валовая прибыль":
      project.metrics.find((m) => m.line === "Валовая прибыль" && m.month === month)?.value ?? 0,
  }));

  const lines = Array.from(new Set(project.metrics.map((m) => m.line))).sort();
  const valueMap = new Map<string, number>();
  for (const m of project.metrics) valueMap.set(`${m.line}__${m.month}`, m.value);

  return (
    <div className="space-y-6">
      <RenameProjectForm code={project.code} name={project.name} />

      {project.yandexMapsInfo && (
        <YandexMapsCard info={project.yandexMapsInfo} recentReviews={project.yandexReviews} />
      )}

      <div className="card">
        <h2 className="mb-3 font-medium">Выручка и валовая прибыль по месяцам</h2>
        {trendData.length > 0 ? (
          <RevenueTrendChart data={trendData} />
        ) : (
          <p className="stat-label">Нет данных.</p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-medium">Все статьи по месяцам</h2>
        <table className="w-full whitespace-nowrap text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4">Статья</th>
              {months.map((month) => (
                <th key={month} className="py-2 pr-4 text-right">
                  {formatMonth(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line} className="border-t border-gray-100">
                <td className="py-2 pr-4">{line}</td>
                {months.map((month) => {
                  const value = valueMap.get(`${line}__${month}`);
                  return (
                    <td key={month} className="py-2 pr-4 text-right">
                      {value !== undefined ? formatRub(value) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
