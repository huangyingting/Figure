"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeContent: "center", fontFamily: "system-ui, sans-serif", background: "#f7f6f2", color: "#17181d", textAlign: "center", padding: "24px" }}>
        <div>
          <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.15em", color: "#6557e8" }}>FIGURE</p>
          <h1 style={{ fontSize: "40px", margin: "8px 0 16px" }}>The application could not load.</h1>
          <p style={{ color: "#6b6b72", marginBottom: "24px" }}>A critical error occurred. Please reload the page.</p>
          <button type="button" onClick={() => reset()} style={{ minHeight: "48px", padding: "0 20px", borderRadius: "10px", border: 0, background: "#17181d", color: "white", fontWeight: 750, cursor: "pointer" }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
