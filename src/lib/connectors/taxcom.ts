/**
 * Такском Касса connector - STUB.
 *
 * Requires env vars: TAXCOM_API_URL, TAXCOM_API_TOKEN
 * (get them from the Такском Касса cabinet -> API access settings).
 *
 * TODO once credentials are available: call the real endpoint, map the
 * response into { line, month, value } records matching the Metric
 * table shape, and upsert them with source = "TAXCOM".
 */
import { ConnectorNotConfiguredError } from "./errors";

export type TaxcomRevenueRecord = {
  pointCode: string;
  month: string; // "YYYY-MM"
  revenue: number;
};

export async function fetchTaxcomRevenue(): Promise<TaxcomRevenueRecord[]> {
  const url = process.env.TAXCOM_API_URL;
  const token = process.env.TAXCOM_API_TOKEN;
  if (!url || !token) {
    throw new ConnectorNotConfiguredError("Такском Касса", [
      ...(!url ? ["TAXCOM_API_URL"] : []),
      ...(!token ? ["TAXCOM_API_TOKEN"] : []),
    ]);
  }

  // TODO: replace with the real Taxcom Kassa API call once we've seen
  // one real request/response pair - do not guess the payload shape.
  throw new Error("Такском Касса: интеграция ещё не реализована (есть только заглушка).");
}
