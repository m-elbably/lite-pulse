import nodemailer from 'nodemailer';
import { logger } from '../../shared/logger';
import type { ValidatedAlertChannel } from '../../config/schemas';
import type { AlertEvent, IdentifiedIncident } from '../dispatcher';
import type { SslCheckResult } from '../../shared/types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function baseEmailShell(title: string, eyebrow: string, body: string, accent: string): string {
  return `
    <div style="background:#f8fafc;padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">
        <div style="padding:20px 24px;background:${accent};color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">${escapeHtml(eyebrow)}</div>
          <div style="margin-top:6px;font-size:24px;font-weight:700;line-height:1.3;">${escapeHtml(title)}</div>
        </div>
        <div style="padding:24px;line-height:1.6;font-size:14px;">
          ${body}
        </div>
      </div>
    </div>
  `.trim();
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;width:160px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:500;">${value}</td>
    </tr>
  `.trim();
}

export function renderIncidentEmail(
  event: AlertEvent,
  serviceName: string,
  incident: IdentifiedIncident,
): { html: string; text: string } {
  const isDown = event === 'incident.opened';
  const subject = isDown ? `${serviceName} is down` : `${serviceName} is back up`;
  const eyebrow = isDown ? 'Incident opened' : 'Incident resolved';
  const accent = isDown ? '#dc2626' : '#16a34a';
  const durationText = incident.duration == null ? '—' : `${Math.round(incident.duration / 1000)}s`;

  const html = baseEmailShell(
    subject,
    eyebrow,
    `
      <p style="margin:0 0 16px;">LitePulse detected a status change for <strong>${escapeHtml(serviceName)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('Service', escapeHtml(serviceName))}
        ${detailRow('Incident ID', `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;padding:2px 6px;border-radius:6px;">${escapeHtml(incident.id)}</code>`)}
        ${detailRow('Started', escapeHtml(incident.openedAt.toISOString()))}
        ${isDown
          ? detailRow('Cause', escapeHtml(incident.cause))
          : `${detailRow('Resolved', escapeHtml(incident.resolvedAt?.toISOString() ?? '—'))}${detailRow('Duration', escapeHtml(durationText))}`}
      </table>
    `,
    accent,
  );

  const text = isDown
    ? `Service: ${serviceName}\nIncident ID: ${incident.id}\nStarted: ${incident.openedAt.toISOString()}\nCause: ${incident.cause}`
    : `Service: ${serviceName}\nIncident ID: ${incident.id}\nStarted: ${incident.openedAt.toISOString()}\nResolved: ${incident.resolvedAt?.toISOString() ?? '—'}\nDuration: ${durationText}`;

  return { html, text };
}

export function renderSslWarningEmail(
  serviceName: string,
  result: SslCheckResult,
): { html: string; text: string } {
  const html = baseEmailShell(
    `${serviceName} SSL certificate is nearing expiry`,
    'SSL expiry warning',
    `
      <p style="margin:0 0 16px;">The certificate used by <strong>${escapeHtml(serviceName)}</strong> is approaching its expiry date.</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow('Service', escapeHtml(serviceName))}
        ${detailRow('Hostname', `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f5f9;padding:2px 6px;border-radius:6px;">${escapeHtml(result.hostname)}</code>`)}
        ${detailRow('Expires', escapeHtml(result.expiresAt.toISOString()))}
        ${detailRow('Days remaining', escapeHtml(String(result.daysRemaining)))}
      </table>
    `,
    '#d97706',
  );

  const text = `Service: ${serviceName}\nHostname: ${result.hostname}\nExpires: ${result.expiresAt.toISOString()}\nDays remaining: ${result.daysRemaining}`;

  return { html, text };
}
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_PORT === '465',
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}
export async function sendEmailAlert(
  channel: ValidatedAlertChannel,
  event: AlertEvent,
  serviceName: string,
  incident: IdentifiedIncident
): Promise<void> {
  const transport = createTransport();
  const isDown = event === 'incident.opened';
  const subject = isDown
    ? `[DOWN] ${serviceName} is down`
    : `[RESOLVED] ${serviceName} is back up`;
  const body = renderIncidentEmail(event, serviceName, incident);
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: channel.to?.join(', '),
    subject,
    text: body.text,
    html: body.html,
  });
  logger.info({ channel: channel.id, event, serviceName }, 'Email alert sent');
}
export async function sendEmailSslWarning(
  channel: ValidatedAlertChannel,
  result: SslCheckResult,
  serviceName: string
): Promise<void> {
  const transport = createTransport();
  const body = renderSslWarningEmail(serviceName, result);
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: channel.to?.join(', '),
    subject: `[SSL WARNING] ${serviceName} certificate expires in ${result.daysRemaining} day(s)`,
    text: body.text,
    html: body.html,
  });
  logger.info({ channel: channel.id, serviceName }, 'Email SSL warning sent');
}
