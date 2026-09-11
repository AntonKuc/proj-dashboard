import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/apiAuth";
import { fetchYandexMapsData, YANDEX_MAPS_LOCATIONS } from "@/lib/connectors/yandexMaps";

// Каждая точка - горстка обычных HTTP-запросов (страница организации +
// несколько страниц отзывов), без пошаговых вызовов вроде Такскома, так
// что весь список из 10 точек укладывается в один вызов без чанкинга по
// датам (у Яндекса и нет фильтра по дате отзывов - см. connectors/yandexMaps.ts).
export const maxDuration = 60;

async function syncAll(projectCodes?: string[]) {
  const results = await fetchYandexMapsData({ projectCodes });

  let reviewsUpserted = 0;
  const infoUpdated: string[] = [];

  for (const [code, { info, reviews }] of results) {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) continue; // код в YANDEX_MAPS_LOCATIONS, но проекта ещё нет в БД - пропускаем, не создаём молча (в отличие от Такскома здесь нет своего "имени по умолчанию")

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

    for (const review of reviews) {
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
    }
  }

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
