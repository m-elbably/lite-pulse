import { describe, expect, it } from 'bun:test';
import { ref } from 'vue';
import { cloneEditableValue } from '../../web/src/lib/cloneEditableValue';

describe('cloneEditableValue', () => {
  it('clones a reactive service into a plain editable copy', () => {
    const state = ref({
      service: {
        id: 'example-api',
        name: 'Example API',
        type: 'http' as const,
        url: 'https://example.com/health',
        interval: 60,
        timeout: 10,
        method: 'GET',
        expectedStatus: 200,
        failureThreshold: 3,
        successThreshold: 2,
        alertChannels: ['email'],
        maintenanceWindows: [{ startHour: 1, startMinute: 15, durationMinutes: 30 }],
        alertCooldownMinutes: 5,
      },
    });

    const editable = cloneEditableValue(state.value.service);

    expect(editable).toEqual(state.value.service);
    editable.name = 'Changed API';
    editable.alertChannels.push('telegram');

    expect(state.value.service.name).toBe('Example API');
    expect(state.value.service.alertChannels).toEqual(['email']);
  });

  it('clones a reactive alert into a plain editable copy', () => {
    const state = ref({
      alert: {
        id: 'ops-email',
        name: 'Ops Email',
        type: 'email' as const,
        to: ['ops@example.com'],
        method: 'POST',
      },
    });

    const editable = cloneEditableValue(state.value.alert);

    expect(editable).toEqual(state.value.alert);
    editable.to?.push('oncall@example.com');

    expect(state.value.alert.to).toEqual(['ops@example.com']);
  });
});
