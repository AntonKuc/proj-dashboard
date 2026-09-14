import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/apiAuth";
import { mapWithConcurrency } from "@/lib/concurrency";
import { fetchYandexMapsData, YANDEX_MAPS_LOCATIONS } from "@/lib/connectors/yandexMaps";

// Каждая точка - горстка обычных HTTP-запросов (страница организации +
// несколько страниц отзывов) плюс запись в БД. Строго последовательная
// обработка всех 10 точек реально вылезала за 60 сек (см. находку
// 2026-09-14 в proj-dashboard-status.md - Vercel Observability показал
// таймаут именно у этого cron'а) - и HTTP-запросы (см.
// connectors/yandexMaps.ts), и upsert'ы в БД (см. syncAll ниже) теперь
// идут небольшими параллельными пачками, а не строго по одной. У Яндекса
// нет фильтра отзывов по дате, так что чанкинг по датам, как у Такскома,
// здесь не применим - весь список отзывов перечитывается каждый раз.
export const maxDuration = 60;

// Сколько точек пишем в БД одновременно, и сколько отзывов одной точки -
// одновременно. Neon отдаёт pooled-соединение (см. .env.example), так
// что умеренный параллелизм по БД безопасен.
const LOCATIONS_WRITE_CONCURRENCY = 3;
const REVIEWS_WRITE_CONCURRENCY = 5;

async function syncAll(projectCodes?: string[]) {
  const results = await fetchYandexMapsData({ projectCodes });

  const infoUpdated: string[] = [];
  let reviewsUpserted = 0;

  // Точки независимы в БД (разные projectId у каждой) - пишем
  // параллельно небольшими пачками, а не строго по одной.
  await mapWithConcurrency(
    [...results.entries()],
    LOCATIONS_WRITE_CONCURRENCY,
    async ([code, { info, reviews }]) => {
      const project = await prisma.project.findUnique({ where: { code } });
      if (!project) return; // код в YANDEX_MAPS_LOCATIONS, но проекта ещё нет в БД - пропускаем, не создаём молча (в отличие от Такскома здесь нет своего "имени по умолчанию")

      await prisma.yandexMapsInfo.upsert({
        where: { projectId: project.id },
        update: {
          orgId: info.orgId,
          ratingValue: info.ratingValue,
          ratingCount: info.ratingCount,
          reviewCount: info.reviewCount,
          address: info.address,
          latitude: info.latitude,
          longitude: info.longitude,
        },
        create: {
          projectId: project.id,
          orgId: info.orgId,
          orgSlug: YANDEX_MAPS_LOCATIONS.find((l) => l.projectCode === code)?.orgSlug ?? "",
          ratingValue: info.ratingValue,
          ratingCount: info.ratingCount,
          reviewCount: info.reviewCount,
          address: info.address,
          latitude: info.latitude,
          longitude: info.longitude,
        },
      });
      infoUpdated.push(code);

      // Отзывы одной точки тоже независимы друг от друга (разные ключи
      // upsert'а) - раньше по одному upsert'у на каждый из уже нескольких
      // сотен отзывов само по себе съедало заметную часть лимита в 60 сек.
      await mapWithConcurrency(reviews, REVIEWS_WRITE_CONCURRENCY, async (review) => {
        await prisma.yandexReview.upsert({
          where: {
            orgId_authorUserId_publishedAt: {
              orgId: review.orgId,
              authorUserId: review.authorUserId,
              publishedAt: review.publishedAt,
            },
          },
          update: { authorName: review.authorName, text: review.text, rating: review.rating },
          create: {
            projectId: project.id,
            orgId: review.orgId,
            authorUserId: review.authorUserId,
            authorName: review.authorName,
            text: review.text,
            rating: review.rating,
            publishedAt: review.publishedAt,
          },
        });
        reviewsUpserted++;
      });
    },
  );

  return { infoUpdated, reviewsUpserted };
}

const bodySchema = z.object({
  projectCodes: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/sync/yandex-maps - ручной синк (admin). Тело:
 * { projectCodes?: string[] } - без кодов синкает все точки сразу.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return apiError("invalid_body", parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }
  if (parsed.data.projectCodes) {
    const known = new Set(YANDEX_MAPS_LOCATIONS.map((l) => l.projectCode));
    const unknown = parsed.data.projectCodes.filter((c) => !known.has(c));
    if (unknown.length > 0) {
      return apiError("unknown_project_codes", `Неизвестные коды проектов: ${unknown.join(", ")}`, 400);
    }
  }

  try {
    const result = await syncAll(parsed.data.projectCodes);
    return apiOk(result);
  } catch (e) {
    return apiError("yandex_maps_sync_failed", e instanceof Error ? e.message : "Unknown error", 502);
  }
}

/**
 * GET /api/v1/sync/yandex-maps - ночной cron-вход (см. vercel.json).
 * Vercel сам добавляет заголовок Authorization: Bearer $CRON_SECRET
 * для вызовов по расписанию - всё остальное отклоняется.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return apiError("unauthorized", "Требуется авторизация", 401);
  }

  try {
    const result = await syncAll();
    return apiOk(result);
  } catch (e) {
    return apiError("yandex_maps_sync_failed", e instanceof Error ? e.message : "Unknown error", 502);
  }
}
