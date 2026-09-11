/**
 * Яндекс Карты connector.
 *
 * No API key needed - Антон подтвердил (2026-09-10), что всё нужное
 * (рейтинг, кол-во отзывов, адрес, координаты, тексты отзывов)
 * публично на обычной странице организации, без логина. Проверено
 * вручную: голый `fetch()` страницы (без куков, без выполнения JS) уже
 * отдаёт всё это сервер-рендеренным в виде микроразметки schema.org.
 *
 * Страница организации: https://yandex.com/maps/org/<любой-slug>/<orgId>/
 *   -> рейтинг, ratingCount, reviewCount, адрес, координаты, плюс 3
 *      последних отзыва.
 * Страница отзывов:     https://yandex.com/maps/org/<любой-slug>/<orgId>/reviews/?page=N
 *   -> до ~50 отзывов на страницу, сервер-рендерено, без скролла и
 *      XHR. Запрашивать page=N+1, пока страница не вернёт ноль
 *      отзывов - это и есть последняя страница (проверено: номера
 *      страниц за пределами реального количества отдают HTTP 200 с
 *      пустым списком, а не 404).
 *
 * slug в URL - косметика: Яндекс резолвит по числовому orgId и
 * полностью игнорирует slug (проверено: мусорный slug с реальным
 * orgId всё равно открывает нужную организацию). Поэтому orgId -
 * стабильный ключ этой сущности (см. README.md, "стабильный ключ
 * сущности") - никогда не переопределять его по названию точки.
 *
 * Открытый риск, о котором Антон предупреждён до реализации: всё
 * вышеперечисленное проверено из настоящей браузерной сессии.
 * Будет ли антибот Яндекса так же спокоен к обычному fetch с
 * серверной (датацентровой) стороны Vercel - не проверено. Если в
 * проде начнёт блокировать - придётся переходить к варианту с VPS и
 * браузерной сессией, описанному в README.md в разделе "Яндекс
 * Карты".
 */

export type YandexMapsLocation = {
  /** Совпадает с Project.code в нашей БД. */
  projectCode: string;
  /** Собственный числовой ID организации в Яндексе - стабильный ключ. */
  orgId: string;
  /** Текущий slug в URL, чисто косметика (Яндекс его игнорирует при роутинге) - хранится только для читаемых ссылок. */
  orgSlug: string;
};

// Резолвнуто вручную из коротких ссылок, которые прислал Антон (xlsx
// "Яндекс карты" в чате, 2026-09-10) - каждая ссылка
// https://yandex.ru/maps/-/<код> была открыта один раз, зафиксирован
// orgId из итогового редиректа. У ВС нет страницы Яндекс Карт ("нет"
// в исходной таблице) - её нет и здесь, это ожидаемо.
export const YANDEX_MAPS_LOCATIONS: YandexMapsLocation[] = [
  { projectCode: "UG", orgId: "9099281714", orgSlug: "uzbek_gourmet" },
  { projectCode: "АП", orgId: "137289058755", orgSlug: "poke_love" },
  { projectCode: "Tomi", orgId: "213647539010", orgSlug: "tomi" },
  { projectCode: "ХО", orgId: "71847713609", orgSlug: "moy_poke" },
  { projectCode: "ТП", orgId: "183738693184", orgSlug: "moyo_poke" },
  { projectCode: "КБ", orgId: "8489889527", orgSlug: "poke_tomyum" },
  { projectCode: "БТ", orgId: "110880951740", orgSlug: "poke_tomyam" },
  { projectCode: "FAVE13", orgId: "242195896469", orgSlug: "fave" },
  { projectCode: "FAVE USCH", orgId: "234273286329", orgSlug: "fave_coffee" },
  { projectCode: "FAVE TS", orgId: "43706228024", orgSlug: "fave" },
];

export type YandexMapsInfoRecord = {
  orgId: string;
  ratingValue: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type YandexReviewRecord = {
  orgId: string;
  authorUserId: string;
  authorName: string;
  text: string;
  rating: number | null;
  publishedAt: Date;
};

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ru-RU,ru;q=0.9",
  Accept: "text/html",
};

function orgUrl(loc: Pick<YandexMapsLocation, "orgId" | "orgSlug">, suffix = ""): string {
  return `https://yandex.com/maps/org/${loc.orgSlug}/${loc.orgId}/${suffix}`;
}

/** Обычный GET с парой ретраев на 429/5xx - без логина и куков (см. комментарий модуля). */
async function fetchHtml(url: string, attempt = 1): Promise<string> {
  const res = await fetch(url, { credentials: "omit", headers: REQUEST_HEADERS });
  if ((res.status === 429 || res.status >= 500) && attempt <= 3) {
    await new Promise((r) => setTimeout(r, attempt * 1000));
    return fetchHtml(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Яндекс Карты: GET ${url} -> HTTP ${res.status}`);
  }
  return res.text();
}

function extractAttr(html: string, marker: string, endQuote = '"'): string | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  const end = html.indexOf(endQuote, start);
  if (end === -1) return null;
  return html.slice(start, end);
}

function extractMetaContent(html: string, itemProp: string): string | null {
  return extractAttr(html, `itemProp="${itemProp}" content="`);
}

/** Чистый парсинг, без I/O - легко тестировать на сохранённом HTML-фикстуре. */
export function parseYandexOrgInfo(html: string, orgId: string): YandexMapsInfoRecord {
  const ratingValue = extractMetaContent(html, "ratingValue");
  const ratingCount = extractMetaContent(html, "ratingCount");
  const reviewCount = extractMetaContent(html, "reviewCount");
  const address = extractAttr(html, 'itemProp="address" content="');
  const coords = extractAttr(html, 'data-coordinates="');
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (coords) {
    const [lon, lat] = coords.split(",").map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      longitude = lon;
      latitude = lat;
    }
  }
  return {
    orgId,
    ratingValue: ratingValue !== null ? Number(ratingValue) : null,
    ratingCount: ratingCount !== null ? Number(ratingCount) : null,
    reviewCount: reviewCount !== null ? Number(reviewCount) : null,
    address,
    latitude,
    longitude,
  };
}

const REVIEW_MARKER = 'itemType="http://schema.org/Review"';

/**
 * Достаёт текст возможно вложенного <span>...</span>, считая глубину
 * вложенности, а не останавливаясь на первом закрывающем теге - в
 * отзыве вложенные span (ссылки, разметка) вполне легальны.
 */
function extractBalancedSpan(html: string, openTagStart: number): string {
  const contentStart = html.indexOf(">", openTagStart) + 1;
  let depth = 1;
  let i = contentStart;
  while (depth > 0) {
    const nextOpen = html.indexOf("<span", i);
    const nextClose = html.indexOf("</span>", i);
    if (nextClose === -1) return html.slice(contentStart); // разметка сломана - возвращаем что есть
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 5;
    } else {
      depth--;
      if (depth === 0) return html.slice(contentStart, nextClose);
      i = nextClose + 7;
    }
  }
  return html.slice(contentStart);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").trim();
}

/** Автор лежит в простом <span itemProp="name">...</span> сразу после маркера - вложенности не ожидается, но на всякий случай используем тот же сбалансированный экстрактор. */
function extractAuthorName(block: string, itemPropIdx: number): string {
  const spanTagStart = block.lastIndexOf("<span", itemPropIdx);
  return stripTags(extractBalancedSpan(block, spanTagStart));
}

/** Чистый парсинг, без I/O - легко тестировать на сохранённом HTML-фикстуре. */
export function parseYandexReviews(html: string, orgId: string): YandexReviewRecord[] {
  const markers: number[] = [];
  let i = -1;
  while ((i = html.indexOf(REVIEW_MARKER, i + 1)) !== -1) markers.push(i);

  const out: YandexReviewRecord[] = [];
  for (let k = 0; k < markers.length; k++) {
    const start = markers[k];
    const end = k + 1 < markers.length ? markers[k + 1] : html.length;
    const block = html.slice(start, end);

    const nameIdx = block.indexOf('itemProp="name"');
    const authorName = nameIdx !== -1 ? extractAuthorName(block, nameIdx) : null;
    const dateStr = extractMetaContent(block, "datePublished");
    const bodyIdx = block.indexOf('itemProp="reviewBody"');
    const spoilerIdx = bodyIdx !== -1 ? block.indexOf("spoiler-view__text-container", bodyIdx) : -1;
    let text: string | null = null;
    if (spoilerIdx !== -1) {
      const spanTagStart = block.lastIndexOf("<span", spoilerIdx);
      text = stripTags(extractBalancedSpan(block, spanTagStart));
    }

    // Оценка (1-5 звёзд) лежит в отдельном itemProp="reviewRating" рядом с
    // остальным блоком отзыва - у Яндекса это "X.0" в разметке, округляем
    // на всякий случай. Отсутствие оценки не считаем сломанным блоком (в
    // отличие от текста/автора/даты) - сохраняем отзыв с rating: null.
    const ratingStr = extractMetaContent(block, "ratingValue");
    const ratingNum = ratingStr !== null ? Math.round(Number(ratingStr)) : null;
    const rating = ratingNum !== null && Number.isFinite(ratingNum) ? ratingNum : null;

    // Не у всех отзывов есть кликабельный профиль (аккаунт удалён/скрыт) -
    // тогда пробуем URL аватарки, а если и его нет (просто буква-плейсхолдер
    // без фото) - имя автора + точное время публикации (мс) практически
    // гарантированно уникальны на практике. Префиксы разные, чтобы не
    // перепутать уровень доверия ключа при отладке.
    const authorUserId =
      extractAttr(block, "/maps/user/", '"') ??
      (() => {
        const avatarUrl = extractMetaContent(block, "image");
        return avatarUrl ? `avatar:${avatarUrl}` : null;
      })() ??
      (authorName && dateStr ? `name:${authorName}` : null);

    if (!authorUserId || !authorName || !dateStr || text === null) continue; // сломанный блок - пропускаем, не сохраняем мусор
    const publishedAt = new Date(dateStr);
    if (Number.isNaN(publishedAt.getTime())) continue;

    out.push({ orgId, authorUserId, authorName, text, rating, publishedAt });
  }
  return out;
}

const REVIEWS_PAGE_SIZE_GUESS = 50; // собственный размер страницы у Яндекса - используется только как подсказка, не как гарантия
const MAX_REVIEW_PAGES = 60; // ~3000 отзывов - намного больше, чем есть у любой нашей точки; страховка от бесконечного цикла, если парсинг когда-нибудь сломается

async function fetchAllReviews(loc: YandexMapsLocation): Promise<YandexReviewRecord[]> {
  const out: YandexReviewRecord[] = [];
  for (let page = 1; page <= MAX_REVIEW_PAGES; page++) {
    const html = await fetchHtml(orgUrl(loc, `reviews/?page=${page}`));
    const reviews = parseYandexReviews(html, loc.orgId);
    if (reviews.length === 0) break; // проверено: страницы за пределами реального количества отдают 200 с пустым списком
    out.push(...reviews);
    if (reviews.length < REVIEWS_PAGE_SIZE_GUESS) break; // короткая страница - почти наверняка последняя, экономит один запрос
  }
  return out;
}

export type YandexMapsSyncResult = {
  info: YandexMapsInfoRecord;
  reviews: YandexReviewRecord[];
};

/**
 * Полный синк для одной или нескольких наших точек: текущий снимок
 * рейтинга/адреса/координат + полный архив отзывов (Антон хочет все,
 * не только последние - решено 2026-09-10).
 *
 * Без диапазона дат (в отличие от Такскома) - у Яндекса нет фильтра
 * отзывов по дате, так что каждый синк перечитывает всё заново. Это
 * не страшно: это горстка обычных HTTP-запросов на точку, а не
 * по запросу на смену, так что весь список точек спокойно
 * укладывается в один вызов serverless-функции.
 */
export async function fetchYandexMapsData(opts: {
  projectCodes?: string[];
}): Promise<Map<string, YandexMapsSyncResult>> {
  const locations = opts.projectCodes
    ? YANDEX_MAPS_LOCATIONS.filter((l) => opts.projectCodes!.includes(l.projectCode))
    : YANDEX_MAPS_LOCATIONS;

  const out = new Map<string, YandexMapsSyncResult>();
  for (const loc of locations) {
    const orgHtml = await fetchHtml(orgUrl(loc));
    const info = parseYandexOrgInfo(orgHtml, loc.orgId);
    const reviews = await fetchAllReviews(loc);
    out.set(loc.projectCode, { info, reviews });
  }
  return out;
}
