/**
 * Runtime pause registry, restored from stored service configuration at startup.
 * Paused services still appear in the dashboard but their checks are skipped.
 * API changes persist before updating this registry.
 */
const paused = new Set<string>();

export function pauseService(id: string): void   { paused.add(id); }
export function resumeService(id: string): void  { paused.delete(id); }
export function isPaused(id: string): boolean    { return paused.has(id); }
export function getPausedIds(): string[]         { return Array.from(paused); }
