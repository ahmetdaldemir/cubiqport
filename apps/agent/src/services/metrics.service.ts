import { execSync } from 'child_process';
import os from 'os';
import type { LiveMetrics, ContainerInfo, NetworkUsage } from '../types.js';

function cpuUsagePercent(): number {
  // Sample CPU over 100ms
  const t1 = cpuTimes();
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  const t2 = cpuTimes();
  const idle = t2.idle - t1.idle;
  const total = t2.total - t1.total;
  return total === 0 ? 0 : Math.round(((total - idle) / total) * 1000) / 10;
}

function cpuTimes() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const val of Object.values(cpu.times)) {
      total += val;
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

function ramUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 1000) / 10;
}

function diskUsagePercent(): number {
  try {
    const output = execSync("df -h / | awk 'NR==2{print $5}'", { encoding: 'utf8' }).trim();
    return parseFloat(output.replace('%', ''));
  } catch {
    return 0;
  }
}

function networkUsage(): NetworkUsage {
  try {
    const output = execSync(
      "cat /proc/net/dev | grep -E 'eth0|ens|enp' | head -1 | awk '{print $2, $10}'",
      { encoding: 'utf8' },
    ).trim();
    const [rx, tx] = output.split(' ').map(Number);
    return { rx: rx ?? 0, tx: tx ?? 0 };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

function runningContainers(): ContainerInfo[] {
  try {
    const output = execSync(
      'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"',
      { encoding: 'utf8' },
    ).trim();

    if (!output) return [];
    return output.split('\n').map((line) => {
      const [id, name, image, status, ports] = line.split('|');
      return {
        id: id?.substring(0, 12) ?? '',
        name: name ?? '',
        image: image ?? '',
        status: status ?? '',
        ports: ports ? ports.split(', ') : [],
      };
    });
  } catch {
    return [];
  }
}

export function collectMetrics(): LiveMetrics {
  return {
    cpuUsage: cpuUsagePercent(),
    ramUsage: ramUsagePercent(),
    diskUsage: diskUsagePercent(),
    networkUsage: networkUsage(),
    containers: runningContainers(),
    uptime: os.uptime(),
    timestamp: new Date().toISOString(),
  };
}
