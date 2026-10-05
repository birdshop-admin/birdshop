import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import ts from "typescript";
function load(file, context = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: () => ({}), ...context },
  );
  return exports;
}
(async () => {
  let timers = new Map(),
    id = 0;
  const doc = new EventTarget(),
    win = new EventTarget();
  doc.visibilityState = "visible";
  const { startVisiblePoll } = load("lib/visible-poll.ts", {
    document: doc,
    window: win,
    AbortController,
    setTimeout: (fn) => {
      timers.set(++id, fn);
      return id;
    },
    clearTimeout: (n) => timers.delete(n),
  });
  let calls = 0,
    resolve,
    signal;
  const stop = startVisiblePoll((s) => {
    calls++;
    signal = s;
    return new Promise((r) => (resolve = r));
  });
  win.dispatchEvent(new Event("online"));
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  resolve();
  await new Promise(setImmediate);
  assert.equal(timers.size, 1);
  doc.visibilityState = "hidden";
  const fn = [...timers.values()][0];
  timers.clear();
  fn();
  assert.equal(calls, 1);
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 2);
  stop();
  assert.equal(signal.aborted, true);
  resolve();
  await new Promise(setImmediate);
  assert.equal(timers.size, 0);
  win.dispatchEvent(new Event("online"));
  assert.equal(calls, 2);
  console.log(
    "PASS Polling: no overlapping requests, pauses hidden, resumes visible, aborts and removes listeners on disposal",
  );
  let complete = 0;
  const stopComplete = startVisiblePoll(async () => {
    complete++;
    return false;
  });
  await new Promise(setImmediate);
  win.dispatchEvent(new Event("online"));
  assert.equal(complete, 1);
  assert.equal(timers.size, 0);
  stopComplete();
  console.log("PASS Terminal result stops polling");
  const { PublicError, publicErrorResponse } = load("lib/server-config.ts", {
    Response,
    process,
    Buffer,
  });
  const unknown = publicErrorResponse(
    new Error("private SQL details"),
    "Please retry.",
  );
  assert.equal((await unknown.json()).error, "Please retry.");
  const limited = publicErrorResponse(
    new PublicError("Wait.", 429, 90),
    "Failed",
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "90");
  console.log(
    "PASS Unknown errors sanitized; rate-limit status and Retry-After preserved",
  );
  const { paymentLabel } = load("lib/payment-display.ts");
  assert.equal(
    paymentLabel({ status: "paid", refund_status: "full" }),
    "Refunded",
  );
  assert.equal(
    paymentLabel({ status: "paid", refunded_amount: 5 }),
    "Partially refunded",
  );
  console.log("PASS Paid cards distinguish partial and full refunds");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
