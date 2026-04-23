import type { MaintenanceWindow } from '../shared/types';

/**
 * Returns true if the given Date falls inside any of the maintenance windows.
 *
 * Window matching:
 *  - weekdays: if defined, only matches on those day-of-week values (0=Sun … 6=Sat).
 *  - startHour / startMinute: local time the window begins.
 *  - durationMinutes: how long the window lasts.
 */
export function isInMaintenance(windows: MaintenanceWindow[], now = new Date()): boolean {
  const dayOfWeek = now.getDay();        // 0–6
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  for (const w of windows) {
    if (w.weekdays && !w.weekdays.includes(dayOfWeek)) continue;

    const startMinutes = w.startHour * 60 + (w.startMinute ?? 0);
    const endMinutes = startMinutes + w.durationMinutes;

    // Handle windows that wrap past midnight
    if (endMinutes <= 1440) {
      if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return true;
    } else {
      // Wraps past midnight — two segments: [start, 1440) and [0, end - 1440)
      if (nowMinutes >= startMinutes || nowMinutes < endMinutes - 1440) return true;
    }
  }
  return false;
}
