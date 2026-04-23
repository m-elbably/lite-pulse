import { describe, it, expect } from 'bun:test';
import {
  AlertChannelInputSchema,
  AlertChannelSchema,
  ServiceConfigInputSchema,
  ServiceConfigSchema,
} from '../../src/config/schemas';

describe('ServiceConfigSchema', () => {
  const base = {
    id: 'my-api',
    name: 'My API',
    type: 'http' as const,
    url: 'https://example.com/health',
    interval: 60,
    timeout: 10,
    failureThreshold: 3,
    successThreshold: 2,
  };

  it('parses a valid http service', () => {
    const result = ServiceConfigSchema.parse(base);
    expect(result.id).toBe('my-api');
    expect(result.method).toBe('GET');
    expect(result.expectedStatus).toBe(200);
    expect(result.maintenanceWindows).toEqual([]);
    expect(result.alertCooldownMinutes).toBe(0);
  });

  it('rejects http service without url', () => {
    expect(() => ServiceConfigSchema.parse({ ...base, url: undefined })).toThrow();
  });

  it('allows admin input without a visible id', () => {
    const result = ServiceConfigInputSchema.parse({
      name: 'Created From UI',
      type: 'http',
      url: 'https://example.com/ui',
      interval: 60,
      timeout: 10,
      failureThreshold: 2,
      successThreshold: 2,
    });

    expect(result.id).toBeUndefined();
  });

  it('rejects interval below 30', () => {
    expect(() => ServiceConfigSchema.parse({ ...base, interval: 10 })).toThrow();
  });

  it('rejects timeout above 30', () => {
    expect(() => ServiceConfigSchema.parse({ ...base, timeout: 60 })).toThrow();
  });

  it('parses sslExpiryWarningDays', () => {
    const result = ServiceConfigSchema.parse({ ...base, sslExpiryWarningDays: 14 });
    expect(result.sslExpiryWarningDays).toBe(14);
  });

  it('rejects sslExpiryWarningDays for non-https URLs', () => {
    expect(() =>
      ServiceConfigSchema.parse({
        ...base,
        url: 'http://example.com/health',
        sslExpiryWarningDays: 14,
      })
    ).toThrow();
  });

  it('parses maintenance windows', () => {
    const result = ServiceConfigSchema.parse({
      ...base,
      maintenanceWindows: [{ weekdays: [0, 6], startHour: 2, startMinute: 0, durationMinutes: 60 }],
    });

    expect(result.maintenanceWindows).toHaveLength(1);
    expect(result.maintenanceWindows?.[0]?.startHour).toBe(2);
  });

  it('parses alertCooldownMinutes', () => {
    const result = ServiceConfigSchema.parse({ ...base, alertCooldownMinutes: 30 });
    expect(result.alertCooldownMinutes).toBe(30);
  });

  it('parses a valid tcp service', () => {
    const tcp = {
      id: 'db',
      name: 'DB',
      type: 'tcp' as const,
      host: 'localhost',
      port: 5432,
      interval: 30,
      timeout: 5,
      failureThreshold: 2,
      successThreshold: 2,
    };

    const result = ServiceConfigSchema.parse(tcp);
    expect(result.host).toBe('localhost');
    expect(result.port).toBe(5432);
  });

  it('rejects tcp service without host/port', () => {
    expect(() =>
      ServiceConfigSchema.parse({
        id: 'db',
        name: 'DB',
        type: 'tcp',
        interval: 30,
        timeout: 5,
        failureThreshold: 2,
        successThreshold: 2,
      })
    ).toThrow();
  });
});


describe('AlertChannelSchema', () => {
  it('parses a valid email channel', () => {
    const channel = AlertChannelSchema.parse({ id: 'email', name: 'Ops Email', type: 'email', to: ['a@b.com'] });
    expect(channel.type).toBe('email');
    expect(channel.name).toBe('Ops Email');
  });

  it('rejects an email channel without recipients', () => {
    expect(() => AlertChannelSchema.parse({ id: 'email', name: 'Ops Email', type: 'email' })).toThrow();
  });

  it('rejects invalid email address', () => {
    expect(() => AlertChannelSchema.parse({ id: 'email', name: 'Ops Email', type: 'email', to: ['not-an-email'] })).toThrow();
  });

  it('parses a valid webhook channel', () => {
    const channel = AlertChannelSchema.parse({ id: 'wh', name: 'Webhook', type: 'webhook', url: 'https://hook.example.com' });
    expect(channel.method).toBe('POST');
  });

  it('rejects a webhook channel without url', () => {
    expect(() => AlertChannelSchema.parse({ id: 'wh', name: 'Webhook', type: 'webhook' })).toThrow();
  });

  it('parses a valid telegram channel', () => {
    const channel = AlertChannelSchema.parse({ id: 'tg', name: 'Telegram', type: 'telegram', chatId: '123', botToken: 'abc:xyz' });
    expect(channel.type).toBe('telegram');
    expect(channel.chatId).toBe('123');
  });

  it('rejects telegram channel without chatId/botToken', () => {
    expect(() => AlertChannelSchema.parse({ id: 'tg', name: 'Telegram', type: 'telegram' })).toThrow();
  });

  it('allows admin input without a visible id', () => {
    const channel = AlertChannelInputSchema.parse({
      name: 'UI Email',
      type: 'email',
      to: ['ops@example.com'],
    });

    expect(channel.id).toBeUndefined();
  });
});
