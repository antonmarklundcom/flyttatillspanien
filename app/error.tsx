"use client";

import { useEffect } from "react";
import { getDictionary, DEFAULT_LOCALE } from "@/i18n";

/**
 * Route error boundary (audit F53): without this file a thrown render error
 * shows Next's raw production error screen. Swedish copy to match the site;
 * reset() re-renders the segment, which recovers transient DB hiccups.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = getDictionary(DEFAULT_LOCALE).common;

  useEffect(() => {
    // Server logs carry the digest; this pairs the client view with it.
    console.error(error);
  }, [error]);

  return (
    <main className="error-page">
      <h1 className="error-page__title">{t.errorTitle}</h1>
      <p className="error-page__text">{t.errorTextPage}</p>
      <div className="error-page__actions">
        <button className="mk-btn mk-btn--accent" onClick={() => reset()}>
          {t.errorRetry}
        </button>
        <a className="mk-btn mk-btn--outline" href="/">
          {t.errorGoHome}
        </a>
      </div>
    </main>
  );
}
