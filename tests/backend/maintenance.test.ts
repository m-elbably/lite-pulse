import { describe, it, expect } from 'bun:test';
import { isInMaintenance } from '../../src/monitoring/maintenance';
import type { MaintenanceWindow } from '../../src/shared/types';

function at(day: number, hour: number, minute: number): Date {
  const d = new Date(2026, 0, 4 + day);
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('isInMaintenance', () => {
  it('returns false when no windows', () => {
    expect(isInMaintenance([], at(0, 2, 30))).toBe(false);
  });

  it('returns true inside window', () => {
    const w: MaintenanceWindow = { startHour: 2, startMinute: 0, durationMinutes: 60 };
    expect(isInMaintenance([w], at(0, 2, 30))).toBe(true);
  });

  it('returns false before window starts', () => {
    const w: MaintenanceWindow = { startHour: 2, startMinute: 0, durationMinutes: 60 };
    expect(isInMaintenance([w], at(0, 1, 59))).toBe(false);
  });

  it('returns false after window ends', () => {
    const w: MaintenanceWindow = { startHour: 2, startMinute: 0, durationMinutes: 60 };
    expect(isInMaintenance([w], at(0, 3, 0))).toBe(false);
  });

  it('respects weekday filter — matches', () => {
    const w: MaintenanceWindow = { weekdays: [0], startHour: 2, startMinute: 0, durationMinutes: 60 };
    expect(isInMaintenance([w], at(0, 2, 15))).toBe(true);
  });

  it('respects weekday filter — does not match', () => {
    const w: MaintenanceWindow = { weekdays: [0], startHour: 2, startMinute: 0, durationMinutes: 60 };
    expect(isInMaintenance([w], at(1, 2, 15))).toBe(false);
  });

  it('handles midnight-spanning window', () => {
    const w: MaintenanceWindow = { startHour: 23, startMinute: 30, durationMinutes: 90 };
    expect(isInMaintenance([w], at(0, 23, 45))).toBe(true);
    expect(isInMaintenance([w], at(1, 0, 30))).toBe(true);
    expect(isInMaintenance([w], at(1, 1, 1))).toBe(false);
  });
});
