import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError, clampLimit } from "@/lib/api";
import { requireSession } from "@/lib/apiAuth";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const { error } = await requireSession();
  if (error) return error;

  const project = await prisma.project.findUnique({ where: { code: params.code } });
  if (!project) return apiError("not_found", "Проект не найден", 404);

  const { searchParams } = new URL(req.url);
  const limit = clampLimit(Number(searchParams.get("limit")) || undefined, 200);
  const cursor = searchParams.get("cursor") ?? undefined;
  const month = searchParams.get("month") ?? undefined;

  const metrics = await prisma.metric.findMany({
    where: { projectId: project.id, ...(month ? { month } : {}) },
    orderBy: [{ month: "asc" }, { line: "asc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = metrics.length > limit;
  const page = hasMore ? metrics.slice(0, limit) : metrics;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return apiOk({ items: page, nextCursor });
}
