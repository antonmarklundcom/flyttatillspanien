"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    // Server logs carry the digest; this pairs the client view with it.
    console.error(error);
  }, [error]);

  return (
    <main className="error-page">
      <h1 className="error-page__title">Något gick fel</h1>
      <p className="error-page__text">
        Vi hade ett problem med att ladda den här sidan. Försök igen om en
        liten stund — om det fortsätter, gå tillbaka till startsidan.
      </p>
      <div className="error-page__actions">
        <button className="mk-btn mk-btn--accent" onClick={() => reset()}>
          Försök igen
        </button>
        <a className="mk-btn mk-btn--outline" href="/">
          Till startsidan
        </a>
      </div>
    </main>
  );
}
