// A single request/timer per view. Visibility and online events resume polling;
// disposal aborts pending work so old routes cannot update the next screen.
export function startVisiblePoll(
  task: (signal: AbortSignal) => Promise<boolean | void>,
  intervalMs = 10000,
) {
  const controller = new AbortController();
  let busy = false,
    finished = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  async function run() {
    if (
      controller.signal.aborted ||
      finished ||
      busy ||
      document.visibilityState !== "visible"
    )
      return;
    clearTimeout(timer);
    busy = true;
    try {
      finished = (await task(controller.signal)) === false;
    } catch {
      /* The task owns its display error; retry transient failures. */
    } finally {
      busy = false;
      if (!controller.signal.aborted && !finished)
        timer = setTimeout(() => void run(), intervalMs);
    }
  }
  function resume() {
    if (document.visibilityState === "visible") void run();
  }
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", resume);
  void run();
  return () => {
    controller.abort();
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("online", resume);
  };
}
