import "server-only";

export function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function siteUrl(): string {
  const url = new URL(env("BIRDSHOP_SITE_URL"));
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")
  ) {
    throw new Error("BIRDSHOP_SITE_URL must use HTTPS in production.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "BIRDSHOP_SITE_URL must be a site origin without credentials, path, or query.",
    );
  return url.origin;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== siteUrl())
    throw new PublicError(
      "This request could not be verified. Reload the page and retry.",
      403,
    );
}

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function objectId(
  value: string | { id: string } | null | undefined,
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export async function readBody(
  request: Request,
  maxBytes = 32768,
): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export class PublicError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "PublicError";
  }
}

// Only explicitly public errors cross the browser boundary.
export function publicErrorResponse(
  error: unknown,
  fallback: string,
  fallbackStatus = 400,
) {
  const known = error instanceof PublicError;
  return Response.json(
    { error: known ? error.message : fallback },
    {
      status: known ? error.status : fallbackStatus,
      headers: {
        ...privateHeaders,
        ...(known && error.status === 429
          ? { "Retry-After": String(error.retryAfter ?? 60) }
          : {}),
      },
    },
  );
}
