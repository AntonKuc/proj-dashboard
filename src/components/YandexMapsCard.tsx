import type { YandexMapsInfo } from "@prisma/client";

// Информационная карточка (не P&L) - рейтинг/адрес из Яндекс Карт.
// Список отзывов сюда не дублируем - полный архив с фильтром смотри в
// YandexReviewsArchive (открывается всплывающим окном).
export default function YandexMapsCard({ info }: { info: YandexMapsInfo }) {
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
      {info.address && <p className="stat-label">{info.address}</p>}
    </div>
  );
}
