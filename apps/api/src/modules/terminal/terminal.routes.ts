import { FastifyInstance } from 'fastify';
import { NodeSSH } from 'node-ssh';
import { ServerRepository } from '../servers/server.repository.js';
import { buildSshOptions } from '../../utils/ssh-credentials.js';
import { logger } from '../../utils/logger.js';

const serverRepo = new ServerRepository();

function parseUrlParams(url: string): { serverId: string | null; token: string | null } {
  try {
    const u = new URL(url, 'http://localhost');
    const token = u.searchParams.get('token');
    const match = u.pathname.match(/([a-f0-9-]{36})\/terminal\/?$/i);
    const serverId = match ? match[1] : null;
    return { serverId, token };
  } catch {
    return { serverId: null, token: null };
  }
}

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/:id/terminal', { websocket: true }, (socket, req) => {
    const url = req.url || '';
    const { serverId, token } = parseUrlParams(url);
    const buffer: Buffer[] = [];
    let shell: Awaited<ReturnType<NodeSSH['requestShell']>> | null = null;
    let ssh: NodeSSH | null = null;

    const cleanup = () => {
      try {
        shell?.destroy();
      } catch (_) {}
      try {
        ssh?.dispose();
      } catch (_) {}
      shell = null;
      ssh = null;
    };

    socket.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const str = raw.toString('utf8');
      if (str.startsWith('{')) {
        try {
          const msg = JSON.parse(str) as { type?: string; rows?: number; cols?: number };
          if (msg.type === 'resize' && typeof msg.rows === 'number' && typeof msg.cols === 'number' && shell?.setWindow) {
            shell.setWindow(msg.rows, msg.cols, msg.rows, msg.cols);
            return;
          }
        } catch (_) {}
      }
      if (shell) {
        shell.write(raw);
      } else {
        buffer.push(raw);
      }
    });

    socket.on('close', () => cleanup());

    (async () => {
      try {
        if (!token || !serverId) {
          socket.close(4401, 'Unauthorized');
          return;
        }
        const decoded = await fastify.jwt.verify(token);
        const userId = (decoded as { sub?: string }).sub;
        if (!userId) {
          socket.close(4401, 'Unauthorized');
          return;
        }
        const server = await serverRepo.findById(serverId, userId);
        if (!server) {
          socket.close(4403, 'Forbidden');
          return;
        }
        ssh = new NodeSSH();
        await ssh.connect({
          ...buildSshOptions(server),
          readyTimeout: 20_000,
        });
        shell = await ssh.requestShell({
          cols: 80,
          rows: 24,
        });
        shell.on('data', (data: Buffer | string) => {
          try {
            const out = typeof data === 'string' ? data : data.toString('utf8');
            if (socket.readyState === 1) socket.send(out);
          } catch (_) {}
        });
        shell.on('close', () => cleanup());
        shell.stderr?.on('data', (data: Buffer | string) => {
          try {
            const out = typeof data === 'string' ? data : data.toString('utf8');
            if (socket.readyState === 1) socket.send(out);
          } catch (_) {}
        });
        for (const b of buffer) shell.write(b);
        buffer.length = 0;
      } catch (err) {
        logger.warn({ err, serverId }, 'Terminal connection failed');
        try {
          socket.close(4500, err instanceof Error ? err.message : 'Connection failed');
        } catch (_) {}
        cleanup();
      }
    })();
  });
}
