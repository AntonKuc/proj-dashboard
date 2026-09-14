import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("returns results in the same order as the input, regardless of completion order", async () => {
    const delays = [30, 10, 20, 5]; // разное время выполнения - специально вперемешку
    const result = await mapWithConcurrency(delays, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3]);
  });

  it("never runs more than `limit` calls at the same time", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (i) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return i;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // параллелизм реально есть, а не свёлся к обычному for-await
  });

  it("handles an empty array", async () => {
    const result = await mapWithConcurrency([] as number[], 5, async (i: number) => i);
    expect(result).toEqual([]);
  });

  it("works when limit is larger than the number of items", async () => {
    const result = await mapWithConcurrency([1, 2, 3], 100, async (i) => i * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("propagates an error from fn", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error("boom");
        return i;
      }),
    ).rejects.toThrow("boom");
  });
});

