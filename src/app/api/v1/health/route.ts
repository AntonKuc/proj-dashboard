import { prisma } from "@/lib/prisma";
import { apiOk, apiError } from "@/lib/api";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiOk({ status: "ok", db: "ok", time: new Date().toISOString() });
  } catch (e) {
    return apiError(
      "db_unreachable",
      e instanceof Error ? e.message : "Unknown error",
      503,
    );
  }
}
