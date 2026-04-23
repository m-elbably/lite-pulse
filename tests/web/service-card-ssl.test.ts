import { describe, expect, it } from 'bun:test';
import { getSslStatusDisplay } from '../../web/src/lib/getSslStatusDisplay';

describe('getSslStatusDisplay', () => {
  it('shows a subtle healthy footer when the certificate is valid beyond the warning threshold', () => {
    const display = getSslStatusDisplay(
      {
        hostname: 'example.com',
        expiresAt: '2030-01-01T00:00:00.000Z',
        daysRemaining: 90,
        checkedAt: '2029-10-03T00:00:00.000Z',
      },
      30,
    );

    expect(display).toEqual({
      variant: 'ok',
      label: 'Certificate valid · 90d left',
      emphasis: false,
    });
  });

  it('shows a warning footer when the certificate is inside the configured warning threshold', () => {
    const display = getSslStatusDisplay(
      {
        hostname: 'example.com',
        expiresAt: '2030-01-01T00:00:00.000Z',
        daysRemaining: 10,
        checkedAt: '2029-12-20T00:00:00.000Z',
      },
      30,
    );

    expect(display).toEqual({
      variant: 'warning',
      label: 'SSL expires in 10d',
      emphasis: true,
    });
  });

  it('hides the footer when no ssl status is available', () => {
    expect(getSslStatusDisplay(null, 30)).toBeNull();
  });
});

