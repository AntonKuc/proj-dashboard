/**
 * Google Диск connector - STUB.
 *
 * Requires env vars: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY,
 * GDRIVE_REPORT_FILE_ID (id of the source spreadsheet on Google Drive).
 *
 * TODO once credentials are available: authenticate with a service
 * account (google-auth-library + googleapis), download/export the
 * sheet, and reuse scripts/extract_xlsx.py's parsing logic (ported to
 * TS) to produce { line, month, value } records with source = "GDRIVE".
 */
import { ConnectorNotConfiguredError } from "./errors";

export async function fetchLatestReportFile(): Promise<Buffer> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const fileId = process.env.GDRIVE_REPORT_FILE_ID;
  if (!email || !key || !fileId) {
    throw new ConnectorNotConfiguredError("Google Диск", [
      ...(!email ? ["GOOGLE_SERVICE_ACCOUNT_EMAIL"] : []),
      ...(!key ? ["GOOGLE_SERVICE_ACCOUNT_KEY"] : []),
      ...(!fileId ? ["GDRIVE_REPORT_FILE_ID"] : []),
    ]);
  }

  // TODO: replace with a real Google Drive API call once we've seen
  // one real request/response pair - do not guess the payload shape.
  throw new Error("Google Диск: интеграция ещё не реализована (есть только заглушка).");
}
