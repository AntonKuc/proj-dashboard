import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]) },
}));

describe("GET /api/v1/health", () => {
  it("responds ok when the database is reachable", async () => {
    const { GET } = await import("@/app/api/v1/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("ok");
    expect(body.data.db).toBe("ok");
  });

  it("responds 503 when the database is unreachable", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("connection refused"),
    );
    const { GET } = await import("@/app/api/v1/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("db_unreachable");
  });
});
