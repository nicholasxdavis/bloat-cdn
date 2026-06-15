const DEFAULT_DELAY_MS = Number(process.env.BLOAT_DELAY_MS ?? 1500);

let lastFetchAt = 0;

export async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = DEFAULT_DELAY_MS - (now - lastFetchAt);
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
