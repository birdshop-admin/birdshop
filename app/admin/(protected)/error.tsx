"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <section
      style={{
        padding: 32,
        minHeight: "calc(60dvh / var(--admin-zoom, 1))",
        color: "#eee8d8",
        background: "#101d13",
      }}
    >
      <h1>This admin view could not load.</h1>
      <p>
        Your records have not been replaced with zero values. Retry to load the
        current data.
      </p>
      <button type="button" onClick={() => retry()} style={{ padding: "14px 22px" }}>
        Try again
      </button>
    </section>
  );
}
