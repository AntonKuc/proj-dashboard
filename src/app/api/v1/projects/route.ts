import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiOk, clampLimit } from "@/lib/api";
import { requireSession } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = clampLimit(Number(searchParams.get("limit")) || undefined);
  const cursor = searchParams.get("cursor") ?? undefined;

  const projects = await prisma.project.findMany({
    orderBy: { code: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = projects.length > limit;
  const page = hasMore ? projects.slice(0, limit) : projects;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return apiOk({ items: page, nextCursor });
}

