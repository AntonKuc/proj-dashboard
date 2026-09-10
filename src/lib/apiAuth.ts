import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api";

/** Returns the session, or null. Use requireSession/requireAdmin in routes. */
export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    return { session: null, error: apiError("unauthorized", "Требуется вход в систему", 401) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user!.role !== "ADMIN") {
    return { session: null, error: apiError("forbidden", "Требуются права администратора", 403) };
  }
  return { session, error: null };
}
