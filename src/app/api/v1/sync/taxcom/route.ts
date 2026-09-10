import { NextRequest } from "next/server";
import { z } from "zod";
import { MetricSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/apiAuth";
import { fetchTaxcomRevenue, TAXCOM_LOCATIONS, type TaxcomRevenueRecord } from "@/lib/connectors/taxcom";

// Vercel serverless functions have a hard execution-time cap (10s on
// Hobby, up to 60s+ on Pro with this setting) and every Taxcom shift
// needs its own API call, so one request must stay narrow. Callers doing
// a historical backfill chunk by date range and/or project instead of
// asking for everything at once.
export const maxDuration = 60;
const MAX_RANGE_DAYS = 45;

async function syncRange(from: Date, to: Date, projectCodes?: string[]) {
  const records = await fetchTaxcomRevenue({ from, to, projectCodes });

  // Create any project that doesn't exist yet (the 3 newest locations
  // aren't seeded). Existing projects/names are left untouched.
  const codes = new Set(records.map((r) => r.projectCode));
  for (const code of codes) {
    const loc = TAXCOM_LOCATIONS.find((l) => l.projectCode === code);
    if (!loc) continue;
    await prisma.project.upsert({
      where: { code },
      update: {},
      create: { code, name: loc.projectName },
    });
  }

  let upserted = 0;
  const monthsTouched = new Set<string>();
  for (const rec of records as TaxcomRevenueRecord[]) {
    const project = await prisma.project.findUnique({ where: { code: rec.projectCode } });
    if (!project) continue; // shouldn't happen after the upsert loop above
    await prisma.metric.upsert({
      where: {
        projectId_line_month_source: {
          projectId: project.id,
          line: rec.line,
          month: rec.month,
          source: MetricSource.TAXCOM,
        },
      },
      update: { value: rec.value },
      create: {
        projectId: project.id,
        line: rec.line,
        month: rec.month,
        value: rec.value,
        source: MetricSource.TAXCOM,
      },
    });
    upserted++;
    monthsTouched.add(rec.month);
  }

  return {
    upserted,
    projectCodes: Array.from(codes).sort(),
    months: Array.from(monthsTouched).sort(),
  };
}

const bodySchema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().date()),
  to: z.string().datetime({ offset: true }).or(z.string().date()),
  projectCodes: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/sync/taxcom - manual/backfill sync (admin only).
 * Body: { from, to (ISO date or datetime), projectCodes?: string[] }.
 * Used to backfill history in chunks, e.g. one month at a time:
 *   { "from": "2025-01-01", "to": "2025-02-01" }
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_body", parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return apiError("invalid_range", "Некорректный диапазон дат (from/to)", 400);
  }
  const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (rangeDays > MAX_RANGE_DAYS) {
    return apiError(
      "range_too_large",
      `Диапазон больше ${MAX_RANGE_DAYS} дней - вызовет таймаут serverless-функции. Разбей на части (например, по месяцу).`,
      400,
    );
  }
  if (parsed.data.projectCodes) {
    const known = new Set(TAXCOM_LOCATIONS.map((l) => l.projectCode));
    const unknown = parsed.data.projectCodes.filter((c) => !known.has(c));
    if (unknown.length > 0) {
      return apiError("unknown_project_codes", `Неизвестные коды проектов: ${unknown.join(", ")}`, 400);
    }
  }

  try {
    const result = await syncRange(from, to, parsed.data.projectCodes);
    return apiOk(result);
  } catch (e) {
    return apiError("taxcom_sync_failed", e instanceof Error ? e.message : "Unknown error", 502);
  }
}

/**
 * GET /api/v1/sync/taxcom - nightly cron entry point (see vercel.json).
 * Vercel sends `Authorization: Bearer $CRON_SECRET` automatically for
 * scheduled invocations when CRON_SECRET is set; anything else is rejected.
 * Syncs a rolling 2-day window (today + yesterday) across all locations,
 * so a shift still open at the previous run's cutoff gets re-summed.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("unauthorized", "Требуется авторизация", 401);
  }

  const to = new Date();
  const from = new Date(to.getTime() - 2 * 24 * 60 * 60 * 1000);
  try {
    const result = await syncRange(from, to);
    return apiOk(result);
  } catch (e) {
    return apiError("taxcom_sync_failed", e instanceof Error ? e.message : "Unknown error", 502);
  }
}
