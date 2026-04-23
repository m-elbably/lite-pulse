import { describe, expect, it, mock } from 'bun:test';
import { MongoAdapter } from '../../src/db/adapters/mongo';
import type { CheckResult } from '../../src/shared/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('MongoAdapter.insertCheckResult', () => {
  it('writes check_results with a UUID _id', async () => {
    const insertOne = mock(async (_doc: unknown) => ({ acknowledged: true }));
    const collection = mock((_name: string) => ({ insertOne }));

    const adapter = new MongoAdapter('mongodb://example.test/lite-pulse');
    (adapter as unknown as { db: { collection: typeof collection } }).db = { collection };

    const result: CheckResult = {
      serviceId: 'svc-1',
      status: 'up',
      responseTime: 123,
      checkedAt: new Date('2026-04-23T18:00:00.000Z'),
      httpStatus: 200,
    };

    await adapter.insertCheckResult(result);

    expect(collection).toHaveBeenCalledWith('check_results');
    expect(insertOne).toHaveBeenCalledTimes(1);

    const inserted = insertOne.mock.calls[0]?.[0] as CheckResult & { _id: string };
    expect(inserted._id).toMatch(UUID_RE);
    expect(inserted.serviceId).toBe('svc-1');
    expect(inserted.status).toBe('up');
    expect(inserted.responseTime).toBe(123);
    expect(inserted.httpStatus).toBe(200);
    expect(inserted.checkedAt).toEqual(result.checkedAt);
  });
});

