"use client";

// Last-resort boundary if the root layout itself fails. It replaces the whole
// document, so it can't rely on globals.css or fonts.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#efe6da", color: "#2e211b", fontFamily: "Georgia, serif" }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 400, fontSize: 36, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#7a6a5e", margin: "0 0 20px" }}>
            Palater hit an unexpected error. Your ratings are safe.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ font: "500 14px system-ui, sans-serif", padding: "10px 18px", borderRadius: 999, border: "1px solid #5e2a3c", background: "#5e2a3c", color: "#efe6da", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
