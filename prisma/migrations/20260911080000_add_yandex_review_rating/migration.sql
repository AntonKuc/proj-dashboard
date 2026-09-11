-- Add optional per-review star rating (1-5), parsed from Yandex's schema.org
-- microdata (nested reviewRating/ratingValue). Existing rows get NULL until
-- the next full sync backfills them.
ALTER TABLE "YandexReview" ADD COLUMN "rating" INTEGER;

