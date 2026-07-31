"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="notfound-page">
      <header>
        <Link className="fx-brand" href="/">
          <span className="fx-brand-mark"><i /><i /><i /></span>
          <span><strong>FIGURE</strong></span>
        </Link>
      </header>
      <section>
        <p>SOMETHING BROKE</p>
        <h1>This view hit an unexpected error.</h1>
        <span>The issue has been logged. You can retry, or head back to a stable page.{error.digest ? ` Reference ${error.digest}.` : ""}</span>
        <div>
          <button className="notfound-primary" type="button" onClick={() => reset()}><RotateCcw size={17} />Try again</button>
          <Link className="notfound-secondary" href="/discover">Browse public figures</Link>
        </div>
      </section>
    </main>
  );
}
