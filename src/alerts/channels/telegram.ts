import { logger } from '../../shared/logger';
import type { ValidatedAlertChannel } from '../../config/schemas';
import type { AlertEvent, IdentifiedIncident } from '../dispatcher';
import type { SslCheckResult } from '../../shared/types';
const TELEGRAM_API = 'https://api.telegram.org';
async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const url = `${TELEGRAM_API}/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ chat_id: chatId, text }),
signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
const body = await res.text();
throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
  await res.body?.cancel();
}
export async function sendTelegramAlert(
  channel: ValidatedAlertChannel,
  event: AlertEvent,
  serviceName: string,
  incident: IdentifiedIncident,
): Promise<void> {
  const isDown = event === 'incident.opened';
  const emoji = isDown ? '🔴' : '✅';
  const lines = [
`${emoji} ${isDown ? 'DOWN' : 'RESOLVED'}: ${serviceName}`,
`Incident: ${incident.id}`,
`Started: ${incident.openedAt.toISOString()}`,
isDown
  ? `Cause: ${incident.cause}`
  : `Resolved: ${incident.resolvedAt?.toISOString()}\nDuration: ${Math.round((incident.duration ?? 0) / 1000)}s`,
  ];
  await sendMessage(channel.botToken!, channel.chatId!, lines.join('\n'));
  logger.info({ channel: channel.id, event, serviceName }, 'Telegram alert sent');
}
export async function sendTelegramSslWarning(
  channel: ValidatedAlertChannel,
  result: SslCheckResult,
  serviceName: string,
): Promise<void> {
  const text = [
`🔐 SSL Certificate Expiry Warning: ${serviceName}`,
`Host: ${result.hostname}`,
`Expires: ${result.expiresAt.toISOString()}`,
`Days remaining: ${result.daysRemaining}`,
  ].join('\n');
  await sendMessage(channel.botToken!, channel.chatId!, text);
  logger.info({ channel: channel.id, serviceName }, 'Telegram SSL warning sent');
}
