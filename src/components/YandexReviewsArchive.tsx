"use client";

import { useState } from "react";
import type { YandexReview } from "@prisma/client";
import { formatMonth } from "@/lib/format";

// Полный архив отзывов Яндекс Карт с фильтром - в отличие от YandexMapsCard
// (последние 5, без интерактива), здесь можно переключаться между
// новизной/положительными/отрицательными. Выдаём не больше MAX_SHOWN сразу,
// а не весь архив (у некоторых точек по 100+ отзывов) - страницы не листаем,
// просто топ-N по выбранному фильтру.
type Filter = "recent" | "positive" | "negative";

const MAX_SHOWN = 10;
const POSITIVE_MIN_RATING = 4; // 4-5 звёзд
const NEGATIVE_MAX_RATING = 3; // 1-3 звёзды (решено 2026-09-11)

const FILTERS: { key: Filter; label: string }[] = [
  { key: "recent", label: "Новизна" },
  { key: "positive", label: "Положительные" },
  { key: "negative", label: "Отрицательные" },
];

export default function YandexReviewsArchive({ reviews }: { reviews: YandexReview[] }) {
  const [filter, setFilter] = useState<Filter>("recent");

  const sorted = [...reviews].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  const filtered =
    filter === "positive"
      ? sorted.filter((r) => r.rating !== null && r.rating >= POSITIVE_MIN_RATING)
      : filter === "negative"
        ? sorted.filter((r) => r.rating !== null && r.rating <= NEGATIVE_MAX_RATING)
        : sorted;
  const shown = filtered.slice(0, MAX_SHOWN);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Все отзывы ({reviews.length})</h2>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                "rounded px-2 py-1 text-xs " +
                (filter === f.key ? "bg-gray-900 text-white" : "stat-label hover:bg-gray-100")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="stat-label text-xs">Нет отзывов по этому фильтру.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <div key={r.id} className="border-t border-gray-100 pt-3 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.authorName}</span>
                <span className="stat-label">
                  {r.rating !== null ? `★ ${r.rating} · ` : ""}
                  {formatMonth(r.publishedAt.toISOString().slice(0, 7))}
                </span>
              </div>
              <p className="mt-1 text-gray-700">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

