import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRub, formatMonth } from "@/lib/format";
import { distinctMonths } from "@/lib/metrics";
import { sortLinesByExcelOrder } from "@/lib/lineOrder";
import RevenueTrendChart, { type TrendPoint } from "@/components/RevenueTrendChart";
import RenameProjectForm from "@/components/RenameProjectForm";
import YandexMapsCard from "@/components/YandexMapsCard";
import YandexReviewsArchive from "@/components/YandexReviewsArchive";

export const dynamic = "force-dynamic";

const RECENT_REVIEWS_ON_PAGE = 5;

export default async function ProjectPage({ params }: { params: { code: string } }) {
  const project = await prisma.project.findUnique({
    where: { code: decodeURIComponent(params.code) },
    include: {
      metrics: true,
      yandexMapsInfo: true,
      yandexReviews: { orderBy: { publishedAt: "desc" } },
    },
  });
  if (!project) notFound();

  const months = distinctMonths(project.metrics);
  const trendData: TrendPoint[] = months.map((month) => ({
    month: formatMonth(month),
    Выручка: project.metrics.find((m) => m.line === "Выручка" && m.month === month)?.value ?? 0,
    Себестоимость:
      project.metrics.find((m) => m.line === "Себестоимость" && m.month === month)?.value ?? 0,
  }));

  const lines = sortLinesByExcelOrder(
    project.code,
    Array.from(new Set(project.metrics.map((m) => m.line))),
  );
  const valueMap = new Map<string, number>();
  for (const m of project.metrics) valueMap.set(`${m.line}__${m.month}`, m.value);

  return (
    <div className="space-y-6">
      <RenameProjectForm code={project.code} name={project.name} />

      {project.yandexMapsInfo && (
        <>
          <YandexMapsCard
            info={project.yandexMapsInfo}
            recentReviews={project.yandexReviews.slice(0, RECENT_REVIEWS_ON_PAGE)}
          />
          <YandexReviewsArchive reviews={project.yandexReviews} />
        </>
      )}

      <div className="card">
        <h2 className="mb-3 font-medium">Выручка и себестоимость по месяцам</h2>
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
