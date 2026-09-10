import type { YandexMapsInfo, YandexReview } from "@prisma/client";
import { formatMonth } from "@/lib/format";

// Информационная карточка (не P&L) - рейтинг/адрес/отзывы из Яндекс Карт.
// Полный архив отзывов лежит в БД (см. src/lib/connectors/yandexMaps.ts),
// здесь показываем только последние несколько - остальное можно достать
// через API при необходимости, отдельный экран под весь архив не делали
// (не просили).
export default function YandexMapsCard({
  info,
  recentReviews,
}: {
  info: YandexMapsInfo;
  recentReviews: YandexReview[];
}) {
  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Яндекс Карты</h2>
        {info.ratingValue !== null && (
          <div className="text-sm">
            <span className="font-semibold">★ {info.ratingValue.toFixed(1)}</span>{" "}
            <span className="stat-label">
              {info.ratingCount ?? 0} оценок · {info.reviewCount ?? 0} отзывов
            </span>
          </div>
        )}
      </div>
      {info.address && <p className="stat-label mb-3">{info.address}</p>}

      {recentReviews.length > 0 && (
        <div className="space-y-3">
          {recentReviews.map((r) => (
            <div key={r.id} className="border-t border-gray-100 pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.authorName}</span>
                <span className="stat-label">
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
