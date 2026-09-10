import { describe, it, expect } from "vitest";
import { aggregateNetRevenueByMonth, monthOf, TAXCOM_LOCATIONS } from "@/lib/connectors/taxcom";

describe("monthOf", () => {
  it("uses the close date when the shift is closed", () => {
    expect(monthOf({ openDateTime: "2026-01-31T23:00:00", closeDateTime: "2026-02-01T02:00:00" })).toBe("2026-02");
  });

  it("falls back to the open date for a still-open shift", () => {
    expect(monthOf({ openDateTime: "2026-03-05T10:00:00", closeDateTime: null })).toBe("2026-03");
  });
});

describe("aggregateNetRevenueByMonth", () => {
  it("sums income minus returns, in rubles, across shifts in the same month", () => {
    const byMonth = aggregateNetRevenueByMonth([
      { openDateTime: "2026-09-01T09:00:00", closeDateTime: "2026-09-01T23:00:00", incomeTotalKopecks: 7471000, incomeReturnTotalKopecks: 0 },
      { openDateTime: "2026-09-02T09:00:00", closeDateTime: "2026-09-02T23:00:00", incomeTotalKopecks: 1000000, incomeReturnTotalKopecks: 50000 },
    ]);
    expect(byMonth.get("2026-09")).toBeCloseTo(74710 + 9500);
  });

  it("splits totals across months and returns rubles, not kopecks", () => {
    const byMonth = aggregateNetRevenueByMonth([
      { openDateTime: "2026-08-31T22:00:00", closeDateTime: "2026-09-01T01:00:00", incomeTotalKopecks: 100000, incomeReturnTotalKopecks: 0 },
      { openDateTime: "2026-08-15T10:00:00", closeDateTime: "2026-08-15T20:00:00", incomeTotalKopecks: 200000, incomeReturnTotalKopecks: 20000 },
    ]);
    expect(byMonth.get("2026-09")).toBeCloseTo(1000);
    expect(byMonth.get("2026-08")).toBeCloseTo(1800);
  });

  it("returns an empty map for no shifts", () => {
    expect(aggregateNetRevenueByMonth([]).size).toBe(0);
  });
});

describe("TAXCOM_LOCATIONS", () => {
  it("has 11 hand-verified locations with no duplicate project codes", () => {
    expect(TAXCOM_LOCATIONS).toHaveLength(11);
    const codes = TAXCOM_LOCATIONS.map((l) => l.projectCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("every location has a non-empty agreementNumber and fn", () => {
    for (const loc of TAXCOM_LOCATIONS) {
      expect(loc.agreementNumber.length).toBeGreaterThan(0);
      expect(loc.fn.length).toBeGreaterThan(0);
    }
  });
});
