export const MAX_FAILED_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Pure decision: is this IP locked out?
 * `failedAttempts` are timestamps of failed login attempts from that IP.
 */
export function isRateLimited(
  failedAttempts: Array<Date | number>,
  now: Date | number = Date.now(),
  max = MAX_FAILED_ATTEMPTS,
  windowMs = WINDOW_MS,
): boolean {
  const nowMs = +now;
  const recent = failedAttempts.filter((t) => {
    const age = nowMs - +t;
    return age >= 0 && age < windowMs;
  });
  return recent.length >= max;
}
