import net from 'net';
import type { ServiceConfig, CheckResult } from '../../shared/types';

export function runTcpCheck(service: ServiceConfig): Promise<CheckResult> {
  return new Promise(resolve => {
    const start = Date.now();
    const checkedAt = new Date();
    const socket = new net.Socket();
    let settled = false;

    const done = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(service.timeout * 1000);

    socket.connect(service.port!, service.host!, () => {
      done({
        serviceId: service.id,
        status: 'up',
        responseTime: Date.now() - start,
        checkedAt,
      });
    });

    socket.on('error', (error: Error) => {
      done({
        serviceId: service.id,
        status: 'down',
        responseTime: Date.now() - start,
        checkedAt,
        error: error.message,
      });
    });

    socket.on('timeout', () => {
      done({
        serviceId: service.id,
        status: 'down',
        responseTime: Date.now() - start,
        checkedAt,
        error: `timeout after ${service.timeout}s`,
      });
    });
  });
}
