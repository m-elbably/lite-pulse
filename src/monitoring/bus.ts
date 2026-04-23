import EventEmitter from 'events';
import type { CheckResult, Incident, SslCheckResult } from '../shared/types';

export type BusEvents = {
  'check.completed': [result: CheckResult];
  'incident.opened': [incident: Incident & { id: string }];
  'incident.resolved': [incident: Incident & { id: string }];
  'ssl.expiry.warning': [result: SslCheckResult];
};

class TypedEventBus extends EventEmitter {
  override emit<K extends keyof BusEvents>(event: K, ...args: BusEvents[K]): boolean {
    return super.emit(event as string, ...args);
  }

  override on<K extends keyof BusEvents>(event: K, listener: (...args: BusEvents[K]) => void): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }
}

export const bus = new TypedEventBus();
