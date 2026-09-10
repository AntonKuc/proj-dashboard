/**
 * 1С connector - STUB.
 *
 * Requires env vars: ONEC_BASE_URL, ONEC_USERNAME, ONEC_PASSWORD
 * (URL of the published 1C:Enterprise HTTP-service, plus a service
 * account with read access to the relevant registers).
 *
 * TODO once credentials are available: call the real HTTP-service,
 * map the response into { line, month, value } records matching the
 * Metric table shape, and upsert them with source = "ONEC".
 */
import { ConnectorNotConfiguredError } from "./errors";

export type OneCLineRecord = {
  projectCode: string;
  line: string;
  month: string; // "YYYY-MM"
  value: number;
};

export async function fetchOneCMetrics(): Promise<OneCLineRecord[]> {
  const url = process.env.ONEC_BASE_URL;
  const username = process.env.ONEC_USERNAME;
  const password = process.env.ONEC_PASSWORD;
  if (!url || !username || !password) {
    throw new ConnectorNotConfiguredError("1С", [
      ...(!url ? ["ONEC_BASE_URL"] : []),
      ...(!username ? ["ONEC_USERNAME"] : []),
      ...(!password ? ["ONEC_PASSWORD"] : []),
    ]);
  }

  // TODO: replace with the real 1C HTTP-service call once we've seen
  // one real request/response pair - do not guess the payload shape.
  throw new Error("1С: интеграция ещё не реализована (есть только заглушка).");
}
