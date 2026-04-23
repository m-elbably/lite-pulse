import { describe, it, expect, beforeEach } from 'bun:test';
import { canAlert, recordAlert, resetCooldown } from '../../src/alerts/cooldown';

describe('cooldown', () => {
  beforeEach(() => resetCooldown('svc-cd'));

  it('allows alert when no cooldown configured', () => {
    expect(canAlert('svc-cd', 0)).toBe(true);
  });

  it('allows first alert regardless of cooldown', () => {
    expect(canAlert('svc-cd', 60_000)).toBe(true);
  });

  it('blocks alert within cooldown period', () => {
    recordAlert('svc-cd');
    expect(canAlert('svc-cd', 60_000)).toBe(false);
  });

  it('allows alert after reset', () => {
    recordAlert('svc-cd');
    resetCooldown('svc-cd');
    expect(canAlert('svc-cd', 60_000)).toBe(true);
  });
});
