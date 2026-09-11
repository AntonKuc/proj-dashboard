import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatRub, formatPercent, formatMonth } from "@/lib/format";
import { valueFor, latestMonth, grossMarginRatio, distinctMonths } from "@/lib/metrics";
import RevenueTrendChart, { type TrendPoint } from "@/components/RevenueTrendChart";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [totalProject, operatingProjects] = await Promise.all([
    prisma.project.findUnique({ where: { code: "ИТОГ" }, include: { metrics: true } }),
    prisma.project.findMany({
      where: { isTotal: false },
      include: { metrics: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const totalMetrics = totalProject?.metrics ?? [];
  const months = distinctMonths(totalMetrics);
  const latest = latestMonth(totalMetrics);

  const trendData: TrendPoint[] = months.map((month) => ({
    month: formatMonth(month),
    Выручка: valueFor(totalMetrics, "Выручка", month),
    Себестоимость: valueFor(totalMetrics, "Себестоимость", month),
  }));

  const ytdRevenue = totalMetrics
    .filter((m) => m.line === "Выручка")
    .reduce((acc, m) => acc + m.value, 0);
  const ytdNetProfit = totalMetrics
    .filter((m) => m.line === "Чистая прибыль")
    .reduce((acc, m) => acc + m.value, 0);
  // Рентабельность считаем с начала года (как и выручку/чистую прибыль выше),
  // а не берём готовое число за последний месяц - иначе показатель скачет
  // на удачных месяцах и не сопоставим с соседними карточками.
  const ytdRentability = ytdRevenue !== 0 ? ytdNetProfit / ytdRevenue : null;

  const comparisonRows = operatingProjects.map((p) => {
    const revenue = latest ? valueFor(p.metrics, "Выручка", latest) : 0;
    const grossProfit = latest ? valueFor(p.metrics, "Валовая прибыль", latest) : 0;
    const fot = latest ? valueFor(p.metrics, "ФОТ", latest) : 0;
    return {
      code: p.code,
      name: p.name,
      revenue,
      grossProfit,
      fot,
      margin: grossMarginRatio(revenue, grossProfit),
    };
  });
  comparisonRows.sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Сводка по всем проектам</h1>
        {latest && (
          <p className="stat-label">
            Последний отчётный месяц: {formatMonth(latest)}. Данные — факт из отчётности,
            загружены вручную.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="stat-label">Выручка, с начала года</div>
          <div className="stat-value">{formatRub(ytdRevenue)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Чистая прибыль, с начала года</div>
          <div className="stat-value">{formatRub(ytdNetProfit)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Рентабельность, с начала года</div>
          <div className="stat-value">{formatPercent(ytdRentability)}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-medium">Выручка и себестоимость по месяцам (ИТОГ)</h2>
        {trendData.length > 0 ? (
          <RevenueTrendChart data={trendData} />
        ) : (
          <p className="stat-label">Нет данных.</p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-medium">
          Сравнение проектов {latest ? `— ${formatMonth(latest)}` : ""}
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2 pr-4">Проект</th>
              <th className="py-2 pr-4 text-right">Выручка</th>
              <th className="py-2 pr-4 text-right">Валовая прибыль</th>
              <th className="py-2 pr-4 text-right">Маржа</th>
              <th className="py-2 pr-4 text-right">ФОТ</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.code} className="border-t border-gray-100">
                <td className="py-2 pr-4">
                  <Link href={`/projects/${encodeURIComponent(row.code)}`} className="text-brand-600 hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-right">{formatRub(row.revenue)}</td>
                <td className="py-2 pr-4 text-right">{formatRub(row.grossProfit)}</td>
                <td className="py-2 pr-4 text-right">{formatPercent(row.margin)}</td>
                <td className="py-2 pr-4 text-right">{formatRub(row.fot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
