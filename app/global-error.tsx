"use client";

/**
 * Last-resort boundary (audit F53): catches errors thrown by the root layout
 * itself, where app/error.tsx can't help. Must render its own <html>/<body>
 * — the layout that normally provides them is the thing that crashed — so
 * styles are inlined; globals.css may not have loaded.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="sv">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Något gick fel</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>
            Vi hade ett problem med att ladda sidan. Försök igen om en liten
            stund.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Försök igen
          </button>
        </div>
      </body>
    </html>
  );
}
