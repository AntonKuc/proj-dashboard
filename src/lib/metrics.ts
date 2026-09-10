/**
 * Core P&L helpers shared by API routes, pages and tests.
 */

export type MetricRow = { line: string; month: string; value: number };

export const PRIMARY_LINES = [
  "Выручка",
  "Себестоимость",
  "Валовая прибыль",
  "ФОТ",
  "Обязательные платежи",
] as const;

/** Sum of `value` across rows matching an exact line name. */
export function sumByLine(rows: MetricRow[], line: string): number {
  return rows.filter((r) => r.line === line).reduce((acc, r) => acc + r.value, 0);
}

/** Value for one line in one month, or 0 if absent. */
export function valueFor(rows: MetricRow[], line: string, month: string): number {
  return rows.find((r) => r.line === line && r.month === month)?.value ?? 0;
}

/** Gross margin (Валовая прибыль / Выручка), or null if revenue is 0. */
export function grossMarginRatio(revenue: number, grossProfit: number): number | null {
  if (revenue === 0) return null;
  return grossProfit / revenue;
}

/** Distinct months present in a set of rows, sorted ascending. */
export function distinctMonths(rows: MetricRow[]): string[] {
  return Array.from(new Set(rows.map((r) => r.month))).sort();
}

/** The most recent month present in a set of rows, or null if empty. */
export function latestMonth(rows: MetricRow[]): string | null {
  const months = distinctMonths(rows);
  return months.length ? months[months.length - 1] : null;
}
