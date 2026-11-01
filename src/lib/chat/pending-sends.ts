/**
 * Retry handles for messages whose send failed, keyed by optimisticId.
 *
 * The composer owns the payload (text, files, reply target) while the message
 * row only knows the optimistic id, so the composer registers a closure here and
 * the row's "Coba lagi" button invokes it. Session-memory only by design: a
 * reload drops unsent messages, as the optimistic rows are never persisted.
 */
const retries = new Map<string, () => void>();

export function registerRetry(optimisticId: string, retry: () => void) {
  retries.set(optimisticId, retry);
}

export function clearRetry(optimisticId: string) {
  retries.delete(optimisticId);
}

export function retrySend(optimisticId: string) {
  const retry = retries.get(optimisticId);
  if (!retry) return false;
  retries.delete(optimisticId);
  retry();
  return true;
}
