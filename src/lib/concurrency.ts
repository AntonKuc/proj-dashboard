/**
 * Обрабатывает элементы с ограниченным параллелизмом: не более `limit`
 * вызовов `fn` одновременно (а не все сразу через Promise.all, и не
 * строго по одному через обычный for-await). Нужен, когда пачка
 * независимых I/O-операций (HTTP-запросы, upsert'ы в БД) в сумме
 * упирается в лимит времени выполнения serverless-функции при строго
 * последовательной обработке - см. использование в
 * connectors/yandexMaps.ts и api/v1/sync/yandex-maps/route.ts.
 *
 * Результаты возвращаются в том же порядке, что и `items`, независимо
 * от порядка завершения - каждый воркер пишет в results[i] по своему
 * индексу, а не push'ит в общий массив.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
