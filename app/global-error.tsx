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
    <html lang="es">
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
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ color: "#555", marginBottom: 16 }}>
            Tuvimos un problema al cargar el sitio. Probá de nuevo en unos
            segundos.
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
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
