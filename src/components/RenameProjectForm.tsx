"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RenameProjectForm({ code, name }: { code: string; name: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.user?.role !== "ADMIN") {
    return <h1 className="text-xl font-semibold">{name}</h1>;
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">{name}</h1>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-500 underline hover:text-gray-700"
        >
          переименовать
        </button>
      </div>
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/v1/projects/${encodeURIComponent(code)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Не удалось сохранить");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="rounded-md border border-gray-300 px-2 py-1 text-xl font-semibold"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-brand-600 px-2 py-1 text-sm text-white disabled:opacity-60"
      >
        {saving ? "…" : "Сохранить"}
      </button>
      <button onClick={() => setEditing(false)} className="text-sm text-gray-500">
        Отмена
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
