/**
 * Яндекс Карты / Яндекс Бизнес connector - STUB.
 *
 * Requires env var: YANDEX_MAPS_API_KEY
 * (and, for per-point ratings, the Yandex Business org/point ids).
 *
 * TODO once credentials are available: call the real API, map the
 * response into a per-project { rating, reviewsCount, address } shape
 * and surface it on the project detail page (this is informational,
 * not a P&L Metric row).
 */
import { ConnectorNotConfiguredError } from "./errors";

export type YandexMapsPointInfo = {
  projectCode: string;
  rating: number;
  reviewsCount: number;
  address: string;
};

export async function fetchYandexMapsPointInfo(): Promise<YandexMapsPointInfo[]> {
  const apiKey = process.env.YANDEX_MAPS_API_KEY;
  if (!apiKey) {
    throw new ConnectorNotConfiguredError("Яндекс Карты", ["YANDEX_MAPS_API_KEY"]);
  }

  // TODO: replace with the real Yandex Maps/Business API call once
  // we've seen one real request/response pair - do not guess the shape.
  throw new Error("Яндекс Карты: интеграция ещё не реализована (есть только заглушка).");
}
