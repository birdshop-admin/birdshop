import "server-only";
import { createHmac, createHash } from "node:crypto";
import { env } from "./server-config";
export function orderToken(attemptId: string) {
  const secret = env("BIRDSHOP_ORDER_TOKEN_SECRET");
  if (secret.length < 32) throw new Error("Order access secret is too short.");
  return createHmac("sha256", secret)
    .update("birdshop-order:" + attemptId)
    .digest("hex");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
