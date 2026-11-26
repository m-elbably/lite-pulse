import type { MaintenanceWindow } from '../shared/types';

/** Windows use server-local time; weekdays identify the day the window starts. */
export function isInMaintenance(windows: MaintenanceWindow[], now = new Date()): boolean {
  for (const window of windows) {
    // Include earlier starts for windows lasting more than one day.
    const days = Math.ceil(window.durationMinutes / 1440) + 1;
    for (let daysAgo = 0; daysAgo <= days; daysAgo++) {
      const start = new Date(now);
      start.setDate(start.getDate() - daysAgo);
      start.setHours(window.startHour, window.startMinute ?? 0, 0, 0);
      if (window.weekdays && !window.weekdays.includes(start.getDay())) continue;
      const elapsed = now.getTime() - start.getTime();
      if (elapsed >= 0 && elapsed < window.durationMinutes * 60_000) return true;
    }
  }
  return false;
}
