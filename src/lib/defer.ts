import { after } from "next/server";

/**
 * Run work that the response does not depend on (audit logs, geolocation,
 * session refresh writes) after the response has been sent.
 *
 * Inside a request this uses Next's `after()`, which keeps the function alive
 * until the task settles, so nothing is lost on serverless. Outside a request
 * scope (scripts, tests) `after()` throws, and the task simply runs detached.
 * Errors are logged, never thrown: a failed audit write must not fail a login.
 */
export function defer(task: () => Promise<unknown>): void {
  const run = () =>
    task().catch((err) => {
      console.error("[defer] background task failed", err);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}
