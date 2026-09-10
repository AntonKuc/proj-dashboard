import { describe, it, expect } from "vitest";
import {
  sumByLine,
  valueFor,
  grossMarginRatio,
  distinctMonths,
  latestMonth,
} from "@/lib/metrics";

const rows = [
  { line: "Выручка", month: "2026-01", value: 100 },
  { line: "Выручка", month: "2026-02", value: 200 },
  { line: "Валовая прибыль", month: "2026-01", value: 40 },
  { line: "Валовая прибыль", month: "2026-02", value: 90 },
];

describe("sumByLine", () => {
  it("sums all values for a matching line across months", () => {
    expect(sumByLine(rows, "Выручка")).toBe(300);
  });

  it("returns 0 for a line with no rows", () => {
    expect(sumByLine(rows, "ФОТ")).toBe(0);
  });
});

describe("valueFor", () => {
  it("returns the value for an exact line+month match", () => {
    expect(valueFor(rows, "Выручка", "2026-02")).toBe(200);
  });

  it("returns 0 when there is no match", () => {
    expect(valueFor(rows, "Выручка", "2026-12")).toBe(0);
  });
});

describe("grossMarginRatio", () => {
  it("computes gross profit / revenue", () => {
    expect(grossMarginRatio(200, 90)).toBeCloseTo(0.45);
  });

  it("returns null when revenue is 0 (avoids division by zero)", () => {
    expect(grossMarginRatio(0, 0)).toBeNull();
  });
});

describe("distinctMonths / latestMonth", () => {
  it("returns sorted unique months", () => {
    expect(distinctMonths(rows)).toEqual(["2026-01", "2026-02"]);
  });

  it("returns the last month chronologically", () => {
    expect(latestMonth(rows)).toBe("2026-02");
  });

  it("returns null for an empty set", () => {
    expect(latestMonth([])).toBeNull();
  });
});
