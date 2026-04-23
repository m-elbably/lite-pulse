/** Tracks last-alert timestamps per service for cooldown enforcement. */
const lastAlertAt = new Map<string, number>();
/**
 * Returns true if an alert for the given service is allowed to fire.
 * @param serviceId  Service identifier.
 * @param cooldownMs Cooldown in milliseconds (0 = always allow).
 */
export function canAlert(serviceId: string, cooldownMs: number): boolean {
  if (cooldownMs <= 0) return true;
  const last = lastAlertAt.get(serviceId);
  return last === undefined || Date.now() - last >= cooldownMs;
}
/** Record that an alert just fired for a service. */
export function recordAlert(serviceId: string): void {
  lastAlertAt.set(serviceId, Date.now());
}
/** Reset cooldown for a service (e.g. after recovery). */
export function resetCooldown(serviceId: string): void {
  lastAlertAt.delete(serviceId);
}
