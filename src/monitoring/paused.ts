/**
 * In-memory pause registry.
 * Paused services still appear in the dashboard but their checks are skipped.
 * State is intentionally volatile — clears on process restart (lightweight behaviour).
 */
const paused = new Set<string>();

export function pauseService(id: string): void   { paused.add(id); }
export function resumeService(id: string): void  { paused.delete(id); }
export function isPaused(id: string): boolean    { return paused.has(id); }
export function getPausedIds(): string[]         { return Array.from(paused); }
