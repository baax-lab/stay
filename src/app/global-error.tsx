"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, color: "#0e3a47" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1>Baax Stay ist gerade nicht erreichbar</h1>
          <p>Bitte in einem Moment erneut versuchen.</p>
          <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#19b5d4", color: "#0e3a47" }}>
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
