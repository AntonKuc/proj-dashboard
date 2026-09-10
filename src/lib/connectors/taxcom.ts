/**
 * Такском Касса connector.
 *
 * Auth: `POST /API/v2/Login` — body `{Login, Password, AgreementNumber}` —
 * returns `{sessionToken}`. One Такском login (env `TAXCOM_LOGIN` /
 * `TAXCOM_PASSWORD`) has access to several "личных кабинетов" (юрлиц/ИП);
 * which one you land in is picked by `AgreementNumber`. Each of our
 * projects below is a hand-verified (agreementNumber, fn) pair — do not
 * try to re-derive this mapping by matching outlet/KKT names at runtime,
 * names get renamed in Taxcom and are not a stable key (see
 * `../connectors/README.md`, "стабильный ключ сущности"). Full derivation
 * notes live in the "Работа" claude.ai project,
 * `claude/taxcom-outlet-code-mapping.md`.
 *
 * `POST /API/v2/kktstat/shifts` — the endpoint one would expect to use for
 * this — is broken for this account: every combination of its filters
 * (DepartmentId/OutletId/KktRegNumber, null/empty/real, alone or combined)
 * returns either a generic HTTP 400 with an empty message, or an unrelated
 * validation error. Verified exhaustively 2026-09; do not retry it.
 *
 * The working chain instead (verified end-to-end with real data):
 *   Login (per agreement) -> ShiftList (per fn, date range) ->
 *   ShiftInfo (per shift) -> sum income.total - incomeReturn.total.
 *
 * Revenue = income.total - incomeReturn.total, i.e. net of returns
 * (decided with Anton 2026-09-10). Taxcom amounts are in kopecks; this
 * module returns/stores rubles.
 */
import { ConnectorNotConfiguredError } from "./errors";

const API_BASE = "https://api-lk-ofd.taxcom.ru";

export type TaxcomLocation = {
  /** Matches Project.code in our DB. Created on first sync if missing. */
  projectCode: string;
  /** Default Project.name if the project doesn't exist yet - editable later in the UI. */
  projectName: string;
  agreementNumber: string;
  /** fnFactoryNumber of the KKT that belongs to this project. */
  fn: string;
};

// Hand-verified against the real Taxcom API on 2026-09-10 (see
// claude/taxcom-outlet-code-mapping.md in the "Работа" project for how
// each row was derived). Гончарова (ХО/ТП) and Шодиев (БТ/FAVE TS) each
// cover two projects under one agreement - that's expected, not a bug.
export const TAXCOM_LOCATIONS: TaxcomLocation[] = [
  { projectCode: "UG", projectName: "UG", agreementNumber: "CD-24/446711", fn: "7380440903423700" },
  { projectCode: "ВС", projectName: "ВС", agreementNumber: "CD-22/367313", fn: "7380440903423672" },
  { projectCode: "АП", projectName: "АП", agreementNumber: "CD-21/302042", fn: "7380440903423707" },
  { projectCode: "Tomi", projectName: "Tomi", agreementNumber: "CD-25/467055", fn: "7384440900809702" },
  { projectCode: "ХО", projectName: "ХО", agreementNumber: "CD-23/413435", fn: "7380440903376069" },
  { projectCode: "ТП", projectName: "ТП", agreementNumber: "CD-23/413435", fn: "7380440903766680" },
  { projectCode: "КБ", projectName: "КБ", agreementNumber: "CD-23/413552", fn: "7384440901121065" },
  { projectCode: "БТ", projectName: "БТ", agreementNumber: "CD-18/169013", fn: "7384440901575251" },
  { projectCode: "FAVE13", projectName: "FAVE13", agreementNumber: "CD-25/463534", fn: "7380440902712986" },
  { projectCode: "FAVE USCH", projectName: "FAVE USCH", agreementNumber: "CD-25/462845", fn: "7380440903374976" },
  { projectCode: "FAVE TS", projectName: "FAVE TS", agreementNumber: "CD-18/169013", fn: "7380440903713610" },
];

export type TaxcomRevenueRecord = {
  projectCode: string;
  line: "Выручка";
  month: string; // "YYYY-MM"
  value: number; // rubles, net of returns
};

/** Thrown when Taxcom rejects the current session token - triggers one re-login. */
class TaxcomAuthError extends Error {}

function requireTaxcomEnv() {
  const integratorId = process.env.TAXCOM_INTEGRATOR_ID;
  const login = process.env.TAXCOM_LOGIN;
  const password = process.env.TAXCOM_PASSWORD;
  const missing = [
    ...(!integratorId ? ["TAXCOM_INTEGRATOR_ID"] : []),
    ...(!login ? ["TAXCOM_LOGIN"] : []),
    ...(!password ? ["TAXCOM_PASSWORD"] : []),
  ];
  if (missing.length > 0) {
    throw new ConnectorNotConfiguredError("Такском Касса", missing);
  }
  return { integratorId: integratorId!, login: login!, password: password! };
}

async function taxcomFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; integratorId: string; sessionToken?: string; body?: string },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    headers: {
      "Integrator-ID": init.integratorId,
      "Content-Type": "application/json",
      ...(init.sessionToken ? { "Session-Token": init.sessionToken } : {}),
    },
    body: init.body,
  });
  if (res.status === 401 || res.status === 403) {
    throw new TaxcomAuthError(`Taxcom API ${path} -> HTTP ${res.status} (сессия истекла?)`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Taxcom API ${path} -> HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

async function loginToAgreement(agreementNumber: string): Promise<string> {
  const { integratorId, login, password } = requireTaxcomEnv();
  const data = await taxcomFetch<{ sessionToken?: string }>("/API/v2/Login", {
    method: "POST",
    integratorId,
    body: JSON.stringify({ Login: login, Password: password, AgreementNumber: agreementNumber }),
  });
  if (!data.sessionToken) {
    throw new Error(`Taxcom Login: пустой sessionToken для договора ${agreementNumber}`);
  }
  return data.sessionToken;
}

// Module-level cache so locations that share an agreement (ХО/ТП,
// БТ/FAVE TS) only log in once per sync run. Serverless instances may stay
// warm between invocations, so a stale token is expected occasionally -
// withSession() below re-logs in once on a 401/403 rather than trusting the
// cache blindly.
const sessionByAgreement = new Map<string, string>();

async function withSession<T>(agreementNumber: string, fn: (sessionToken: string) => Promise<T>): Promise<T> {
  let token = sessionByAgreement.get(agreementNumber);
  if (!token) {
    token = await loginToAgreement(agreementNumber);
    sessionByAgreement.set(agreementNumber, token);
  }
  try {
    return await fn(token);
  } catch (e) {
    if (!(e instanceof TaxcomAuthError)) throw e;
    token = await loginToAgreement(agreementNumber);
    sessionByAgreement.set(agreementNumber, token);
    return await fn(token);
  }
}

type ShiftListRecord = {
  shiftNumber: number;
  openDateTime: string;
  closeDateTime: string | null;
};

type ShiftInfoResponse = {
  shift?: {
    income?: { total?: number };
    incomeReturn?: { total?: number };
  };
};

/** Taxcom expects local-naive "YYYY-MM-DDTHH:mm:ss", no timezone suffix. */
function fmtTaxcomDate(d: Date): string {
  return d.toISOString().slice(0, 19);
}

export type ShiftFinancials = {
  openDateTime: string;
  closeDateTime: string | null;
  incomeTotalKopecks: number;
  incomeReturnTotalKopecks: number;
};

/** Month a shift's revenue should be attributed to - close date, falling back to open date for a still-open shift. */
export function monthOf(shift: Pick<ShiftFinancials, "openDateTime" | "closeDateTime">): string {
  return (shift.closeDateTime ?? shift.openDateTime).slice(0, 7);
}

/** Pure aggregation, no I/O - net revenue (rubles) per "YYYY-MM", easy to unit-test. */
export function aggregateNetRevenueByMonth(shifts: ShiftFinancials[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  for (const s of shifts) {
    const netKopecks = s.incomeTotalKopecks - s.incomeReturnTotalKopecks;
    const month = monthOf(s);
    byMonth.set(month, (byMonth.get(month) ?? 0) + netKopecks / 100);
  }
  return byMonth;
}

async function fetchShiftFinancialsForLocation(loc: TaxcomLocation, from: Date, to: Date): Promise<ShiftFinancials[]> {
  const { integratorId } = requireTaxcomEnv();

  const shifts = await withSession(loc.agreementNumber, (token) =>
    taxcomFetch<{ records?: ShiftListRecord[] }>(
      `/API/v2/ShiftList?fn=${loc.fn}&begin=${fmtTaxcomDate(from)}&end=${fmtTaxcomDate(to)}`,
      { method: "GET", integratorId, sessionToken: token },
    ),
  );

  const out: ShiftFinancials[] = [];
  for (const s of shifts.records ?? []) {
    const info = await withSession(loc.agreementNumber, (token) =>
      taxcomFetch<ShiftInfoResponse>(`/API/v2/ShiftInfo?fn=${loc.fn}&shift=${s.shiftNumber}`, {
        method: "GET",
        integratorId,
        sessionToken: token,
      }),
    );
    out.push({
      openDateTime: s.openDateTime,
      closeDateTime: s.closeDateTime,
      incomeTotalKopecks: info.shift?.income?.total ?? 0,
      incomeReturnTotalKopecks: info.shift?.incomeReturn?.total ?? 0,
    });
  }
  return out;
}

/**
 * Net revenue for one or more of our projects, for one date range.
 *
 * Kept narrow on purpose - each Taxcom shift needs its own ShiftInfo call,
 * so a full multi-year, all-locations backfill is thousands of requests
 * and far too slow for one serverless invocation. Callers (see
 * `/api/v1/sync/taxcom`) chunk by date range and/or project.
 */
export async function fetchTaxcomRevenue(opts: {
  from: Date;
  to: Date;
  projectCodes?: string[];
}): Promise<TaxcomRevenueRecord[]> {
  requireTaxcomEnv();
  const locations = opts.projectCodes
    ? TAXCOM_LOCATIONS.filter((l) => opts.projectCodes!.includes(l.projectCode))
    : TAXCOM_LOCATIONS;

  const out: TaxcomRevenueRecord[] = [];
  for (const loc of locations) {
    const shifts = await fetchShiftFinancialsForLocation(loc, opts.from, opts.to);
    for (const [month, value] of aggregateNetRevenueByMonth(shifts)) {
      out.push({ projectCode: loc.projectCode, line: "Выручка", month, value });
    }
  }
  return out;
}
