"use client";

// Replaces the root layout when it fails, so global CSS and the theme are unavailable.
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#000000",
          color: "#f0ece2",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <title>BirdShop is temporarily unavailable</title>
        <main style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ letterSpacing: "0.2em", fontSize: 12 }}>BIRDSHOP</p>
          <h1 style={{ fontSize: 34, fontWeight: 400 }}>
            BirdShop is temporarily unavailable.
          </h1>
          <p style={{ color: "rgba(240,236,226,0.75)", lineHeight: 1.7 }}>
            Nothing in your cart, payment or private chat has changed. Please
            try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 18,
              minHeight: 48,
              padding: "0 24px",
              borderRadius: 2,
              border: "1px solid #b3233c",
              background: "#941128",
              color: "#f0ece2",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  );
}
