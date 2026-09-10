import { NextResponse } from "next/server";

/**
 * Every API route in this project responds with a uniform shape:
 *   success: { data: ... }               (or { data, nextCursor } for lists)
 *   error:   { error: { code, message } }
 */

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export const MAX_PAGE_SIZE = 200;

/** Clamp a requested page size to the project-wide list cap. */
export function clampLimit(requested: number | null | undefined, fallback = 50): number {
  const n = requested ?? fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, MAX_PAGE_SIZE);
}
