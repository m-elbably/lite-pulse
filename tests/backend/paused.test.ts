import { describe, it, expect, beforeEach } from 'bun:test';
import { isPaused, pauseService, resumeService, getPausedIds } from '../../src/monitoring/paused';

describe('paused', () => {
  beforeEach(() => {
    resumeService('svc-p');
    resumeService('svc-q');
  });

  it('service is not paused by default', () => {
    expect(isPaused('svc-p')).toBe(false);
  });

  it('pauses a service', () => {
    pauseService('svc-p');
    expect(isPaused('svc-p')).toBe(true);
  });

  it('resumes a paused service', () => {
    pauseService('svc-p');
    resumeService('svc-p');
    expect(isPaused('svc-p')).toBe(false);
  });

  it('getPausedIds lists all paused services', () => {
    pauseService('svc-p');
    pauseService('svc-q');
    expect(getPausedIds()).toContain('svc-p');
    expect(getPausedIds()).toContain('svc-q');
  });
});
