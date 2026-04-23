import { describe, expect, it } from 'bun:test';
import { renderIncidentEmail, renderSslWarningEmail } from '../../src/alerts/channels/email';

describe('renderIncidentEmail', () => {
  it('renders a styled HTML down alert with a plain-text fallback', () => {
    const email = renderIncidentEmail('incident.opened', 'Example API', {
      id: 'inc-1',
      serviceId: 'svc-1',
      status: 'open',
      openedAt: new Date('2026-04-23T10:00:00.000Z'),
      cause: 'Connection refused by example.com. The host is reachable, but nothing is accepting connections at the target port.',
    });

    expect(email.html).toContain('Incident opened');
    expect(email.html).toContain('Example API');
    expect(email.html).toContain('Connection refused by example.com');
    expect(email.html).toContain('background:#dc2626');
    expect(email.text).toContain('Service: Example API');
    expect(email.text).toContain('Incident ID: inc-1');
  });
});

describe('renderSslWarningEmail', () => {
  it('renders an HTML SSL expiry email with hostname and days remaining', () => {
    const email = renderSslWarningEmail('Example API', {
      serviceId: 'svc-1',
      hostname: 'example.com',
      expiresAt: new Date('2026-05-01T00:00:00.000Z'),
      daysRemaining: 8,
      checkedAt: new Date('2026-04-23T10:00:00.000Z'),
    });

    expect(email.html).toContain('SSL expiry warning');
    expect(email.html).toContain('example.com');
    expect(email.html).toContain('Days remaining');
    expect(email.text).toContain('Hostname: example.com');
    expect(email.text).toContain('Days remaining: 8');
  });
});

