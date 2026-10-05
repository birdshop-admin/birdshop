"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section
      style={{
        padding: 32,
        minHeight: "60dvh",
        color: "#eee8d8",
        background: "#101d13",
      }}
    >
      <h1>This admin view could not load.</h1>
      <p>
        Your records have not been replaced with zero values. Retry to load the
        current data.
      </p>
      <button onClick={reset} style={{ padding: "14px 22px" }}>
        Try again
      </button>
    </section>
  );
}
