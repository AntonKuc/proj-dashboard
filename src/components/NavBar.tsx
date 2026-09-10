"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function NavBar() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <header className="border-b border-[#e6e8f0] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-[#1a1d29]">
          Проекты
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            {session.user.name} · {session.user.role === "ADMIN" ? "admin" : "viewer"}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
