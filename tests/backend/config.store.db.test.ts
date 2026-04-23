import { beforeEach, describe, expect, it } from 'bun:test';
import { setAdapter } from '../../src/db/adapter';
import { SqliteAdapter } from '../../src/db/adapters/sqlite';
import {
  ConfigStoreError,
  createAlert,
  createService,
  listConfig,
  updateService,
} from '../../src/config/store';
import type { ValidatedAlertChannelInput, ValidatedServiceConfigInput } from '../../src/config/schemas';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createServicePayload(overrides: Partial<ValidatedServiceConfigInput> = {}): ValidatedServiceConfigInput {
  return {
    name: 'Example API',
    type: 'http',
    url: 'https://example.com/health',
    interval: 60,
    timeout: 10,
    method: 'GET',
    expectedStatus: 200,
    failureThreshold: 3,
    successThreshold: 2,
    alertChannels: [],
    maintenanceWindows: [],
    alertCooldownMinutes: 0,
    ...overrides,
  };
}

function createAlertPayload(overrides: Partial<ValidatedAlertChannelInput> = {}): ValidatedAlertChannelInput {
  return {
    name: 'Ops Email',
    type: 'email',
    method: 'POST',
    to: ['ops@example.com'],
    ...overrides,
  };
}

describe('config store (db-backed)', () => {
  beforeEach(async () => {
    const adapter = new SqliteAdapter(':memory:');
    setAdapter(adapter);
    await adapter.connect();
    await adapter.ensureSchema();
  });

  it('creates alerts and services with generated hidden ids', async () => {
    const configAfterAlert = await createAlert(createAlertPayload({
      description: 'Primary on-call mailbox',
    }));

    const createdAlert = configAfterAlert.alerts[0];
    expect(createdAlert?.id).toBeString();
    expect(createdAlert?.id).toMatch(UUID_RE);
    expect(createdAlert?.name).toBe('Ops Email');

    const configAfterService = await createService(createServicePayload({
      name: 'Public API',
      alertChannels: [createdAlert!.id],
    }));

    const createdService = configAfterService.services[0];
    expect(createdService?.id).toBeString();
    expect(createdService?.id).toMatch(UUID_RE);
    expect(createdService?.name).toBe('Public API');
    expect(createdService?.alertChannels).toEqual([createdAlert!.id]);
  });

  it('keeps the original internal id when updating a service', async () => {
    const createdConfig = await createService(createServicePayload({
      name: 'Worker API',
      failureThreshold: 2,
      successThreshold: 2,
      url: 'https://example.com/worker',
    }));

    const createdService = createdConfig.services[0]!;

    const updatedConfig = await updateService(createdService.id, {
      ...createdService,
      id: 'attempted-visible-change',
      name: 'Worker API v2',
    });

    expect(updatedConfig.services[0]?.id).toBe(createdService.id);
    expect(updatedConfig.services[0]?.name).toBe('Worker API v2');
  });

  it('rejects duplicate service names case-insensitively', async () => {
    await createService(createServicePayload({
      name: 'Customer API',
      url: 'https://example.com/customer',
    }));

    expect(
      createService(createServicePayload({
        name: ' customer api ',
        url: 'https://example.com/customer-2',
      })),
    ).rejects.toBeInstanceOf(ConfigStoreError);
  });

  it('lists config from the database', async () => {
    await createAlert(createAlertPayload({
      name: 'Telegram Ops',
      type: 'telegram',
      to: undefined,
      chatId: '123',
      botToken: 'token',
    }));

    const config = await listConfig();

    expect(config.alerts).toHaveLength(1);
    expect(config.alerts[0]?.name).toBe('Telegram Ops');
  });
});
