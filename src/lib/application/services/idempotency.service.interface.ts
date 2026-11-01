/**
 * Short-lived "have I already done this?" store, used to make retried client
 * requests safe (e.g. resending a message whose response was lost).
 */
export interface IIdempotencyStore {
  /** Atomically claim `key`. Returns null when claimed now, else the stored value. */
  claim(key: string, ttlSeconds: number): Promise<string | null>;
  /** Record the result for a claimed key. */
  complete(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Give up a claim (the operation failed), so a retry can run. */
  release(key: string): Promise<void>;
}
