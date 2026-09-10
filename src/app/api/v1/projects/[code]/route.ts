import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api";
import { requireSession, requireAdmin } from "@/lib/apiAuth";

export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const { error } = await requireSession();
  if (error) return error;

  const project = await prisma.project.findUnique({ where: { code: params.code } });
  if (!project) return apiError("not_found", "Проект не найден", 404);
  return apiOk(project);
}

const patchSchema = z.object({ name: z.string().min(1).max(200) });

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("invalid_body", parsed.error.issues[0]?.message ?? "Некорректные данные", 400);
  }

  const project = await prisma.project.findUnique({ where: { code: params.code } });
  if (!project) return apiError("not_found", "Проект не найден", 404);

  const updated = await prisma.project.update({
    where: { code: params.code },
    data: { name: parsed.data.name },
  });
  return apiOk(updated);
}
