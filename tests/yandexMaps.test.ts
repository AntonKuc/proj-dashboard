import { describe, it, expect } from "vitest";
import { parseYandexOrgInfo, parseYandexReviews, YANDEX_MAPS_LOCATIONS } from "@/lib/connectors/yandexMaps";

describe("parseYandexOrgInfo", () => {
  it("reads rating, address and coordinates from schema.org microdata", () => {
    const html = `
      <div itemType="http://schema.org/LocalBusiness" data-id="123456" data-coordinates="37.617734,55.755826">
        <meta itemProp="address" content="Москва, ул. Тверская, 1">
        <div itemProp="aggregateRating" itemType="http://schema.org/AggregateRating">
          <meta itemProp="ratingValue" content="4.8">
          <meta itemProp="ratingCount" content="120">
          <meta itemProp="reviewCount" content="95">
        </div>
      </div>
    `;
    const info = parseYandexOrgInfo(html, "123456");
    expect(info).toEqual({
      orgId: "123456",
      ratingValue: 4.8,
      ratingCount: 120,
      reviewCount: 95,
      address: "Москва, ул. Тверская, 1",
      latitude: 55.755826,
      longitude: 37.617734,
    });
  });

  it("returns nulls when a new point has no rating yet, but keeps the orgId", () => {
    const html = `<div itemType="http://schema.org/LocalBusiness" data-id="1"></div>`;
    const info = parseYandexOrgInfo(html, "1");
    expect(info).toEqual({
      orgId: "1",
      ratingValue: null,
      ratingCount: null,
      reviewCount: null,
      address: null,
      latitude: null,
      longitude: null,
    });
  });
});

describe("parseYandexReviews", () => {
  // Три уровня authorUserId в одном фикстуре + один сломанный блок без
  // текста (должен быть пропущен, а не сохранён с пустым текстом).
  const reviewWithProfileLink = `
    <div itemType="http://schema.org/Review">
      <div itemProp="author" itemType="http://schema.org/Person">
        <a href="https://yandex.com/maps/user/abc123XYZ">
          <span itemProp="name">Иван Петров</span>
        </a>
      </div>
      <meta itemProp="datePublished" content="2026-01-15T10:30:00.123Z">
      <div itemProp="reviewBody">
        <span class="spoiler-view__text-container">Очень <span class="highlight">вкусно</span>, всем рекомендую!</span>
      </div>
    </div>
  `;

  const reviewWithAvatarOnly = `
    <div itemType="http://schema.org/Review">
      <div itemProp="author" itemType="http://schema.org/Person">
        <meta itemProp="image" content="https://avatars.mds.yandex.net/get-yapic/12345/avatar">
        <span itemProp="name">Мария Сидорова</span>
      </div>
      <meta itemProp="datePublished" content="2026-02-20T08:00:00.000Z">
      <div itemProp="reviewBody">
        <span class="spoiler-view__text-container">Неплохо, но долго ждали заказ.</span>
      </div>
    </div>
  `;

  const reviewWithLetterPlaceholderOnly = `
    <div itemType="http://schema.org/Review">
      <div itemProp="author" itemType="http://schema.org/Person">
        <span itemProp="name">А</span>
      </div>
      <meta itemProp="datePublished" content="2026-03-01T12:00:00.000Z">
      <div itemProp="reviewBody">
        <span class="spoiler-view__text-container">Средне.</span>
      </div>
    </div>
  `;

  const reviewWithoutBody = `
    <div itemType="http://schema.org/Review">
      <div itemProp="author" itemType="http://schema.org/Person">
        <span itemProp="name">Пропущенный</span>
      </div>
      <meta itemProp="datePublished" content="2026-04-01T00:00:00.000Z">
    </div>
  `;

  it("uses the profile-link id when a reviewer has a public profile", () => {
    const reviews = parseYandexReviews(reviewWithProfileLink, "999");
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      orgId: "999",
      authorUserId: "abc123XYZ",
      authorName: "Иван Петров",
    });
    expect(reviews[0].publishedAt.toISOString()).toBe("2026-01-15T10:30:00.123Z");
  });

  it("strips nested markup inside the review text (e.g. inline highlight spans)", () => {
    const reviews = parseYandexReviews(reviewWithProfileLink, "999");
    expect(reviews[0].text).toBe("Очень вкусно, всем рекомендую!");
  });

  it("falls back to the avatar URL when there is no profile link", () => {
    const reviews = parseYandexReviews(reviewWithAvatarOnly, "999");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].authorUserId).toBe("avatar:https://avatars.mds.yandex.net/get-yapic/12345/avatar");
  });

  it("falls back to name+timestamp when there is neither a profile link nor an avatar", () => {
    const reviews = parseYandexReviews(reviewWithLetterPlaceholderOnly, "999");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].authorUserId).toBe("name:А");
  });

  it("skips a broken review block that has no body text instead of saving empty text", () => {
    const reviews = parseYandexReviews(reviewWithoutBody, "999");
    expect(reviews).toHaveLength(0);
  });

  it("parses every review on a page and produces no duplicate dedupe keys", () => {
    const page =
      reviewWithProfileLink + reviewWithAvatarOnly + reviewWithLetterPlaceholderOnly + reviewWithoutBody;
    const reviews = parseYandexReviews(page, "999");
    expect(reviews).toHaveLength(3);
    const keys = reviews.map((r) => `${r.orgId}|${r.authorUserId}|${r.publishedAt.toISOString()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("returns an empty array when the page has no review blocks", () => {
    expect(parseYandexReviews("<div>нет отзывов</div>", "999")).toEqual([]);
  });
});

describe("YANDEX_MAPS_LOCATIONS", () => {
  it("has 10 hand-resolved locations with no duplicate project codes or orgIds (ВС intentionally absent)", () => {
    expect(YANDEX_MAPS_LOCATIONS).toHaveLength(10);
    const codes = YANDEX_MAPS_LOCATIONS.map((l) => l.projectCode);
    expect(new Set(codes).size).toBe(codes.length);
    const orgIds = YANDEX_MAPS_LOCATIONS.map((l) => l.orgId);
    expect(new Set(orgIds).size).toBe(orgIds.length);
  });

  it("every location has a non-empty orgId and orgSlug", () => {
    for (const loc of YANDEX_MAPS_LOCATIONS) {
      expect(loc.orgId.length).toBeGreaterThan(0);
      expect(loc.orgSlug.length).toBeGreaterThan(0);
    }
  });
});
