import * as Sentry from "@sentry/nextjs";

// Only enabled when SENTRY_DSN is set - see README "Sentry" section.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
