import type { SslStatus } from '../types';

export type SslDisplayVariant = 'ok' | 'warning' | 'critical' | 'error';

export interface SslStatusDisplay {
  variant: SslDisplayVariant;
  label: string;
  emphasis: boolean;
}

export function getSslStatusDisplay(
  sslStatus: SslStatus | null,
  warningDays: number | null,
): SslStatusDisplay | null {
  if (!sslStatus) {
    return null;
  }

  if (sslStatus.error) {
    return {
      variant: 'error',
      label: 'SSL check failed',
      emphasis: true,
    };
  }

  const effectiveWarningDays = warningDays ?? 30;
  const criticalDays = Math.min(7, effectiveWarningDays);

  if (sslStatus.daysRemaining <= criticalDays) {
    return {
      variant: 'critical',
      label: `SSL expires in ${sslStatus.daysRemaining}d`,
      emphasis: true,
    };
  }

  if (sslStatus.daysRemaining <= effectiveWarningDays) {
    return {
      variant: 'warning',
      label: `SSL expires in ${sslStatus.daysRemaining}d`,
      emphasis: true,
    };
  }

  return {
    variant: 'ok',
    label: `Certificate valid · ${sslStatus.daysRemaining}d left`,
    emphasis: false,
  };
}

