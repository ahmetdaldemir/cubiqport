import { ServerRepository } from './server.repository.js';
import { testSshConnection, installAgent } from '../../services/ssh.service.js';
import { AgentService } from '../../services/agent.service.js';
import { encrypt, decrypt } from '../../utils/encrypt.js';
import { NotFoundError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { CreateServerInput, UpdateServerInput } from '@cubiqport/shared';

const repo = new ServerRepository();
const agentService = new AgentService();

export class ServerService {
  async listServers(userId: string) {
    const servers = await repo.findAll(userId);
    // Strip encrypted SSH key from response
    return servers.map(({ sshKey: _, ...s }) => s);
  }

  async getServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const { sshKey: _, ...rest } = server;
    return rest;
  }

  async createServer(userId: string, input: CreateServerInput) {
    const encryptedKey = encrypt(input.sshKey);
    const server = await repo.create({
      userId,
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      sshUser: input.sshUser,
      sshKey: encryptedKey,
      status: 'pending',
    });

    // Test connection asynchronously — don't block the response
    this.testAndSetStatus(server.id, server.ip, server.sshPort, server.sshUser, input.sshKey).catch(
      (err) => logger.error({ err, serverId: server.id }, 'Background SSH test failed'),
    );

    const { sshKey: _, ...rest } = server;
    return rest;
  }

  async updateServer(id: string, userId: string, input: UpdateServerInput) {
    const existing = await repo.findById(id, userId);
    if (!existing) throw new NotFoundError('Server');

    const server = await repo.update(id, userId, {
      name: input.name,
      ip: input.ip,
      sshPort: input.sshPort,
      sshUser: input.sshUser,
    });
    if (!server) throw new NotFoundError('Server');
    const { sshKey: _, ...rest } = server;
    return rest;
  }

  async deleteServer(id: string, userId: string) {
    const deleted = await repo.delete(id, userId);
    if (!deleted) throw new NotFoundError('Server');
  }

  async testConnection(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const privateKey = decrypt(server.sshKey);
    await testSshConnection({
      host: server.ip,
      port: server.sshPort,
      username: server.sshUser,
      privateKey,
    });
    await repo.updateStatus(id, 'active');
    return { connected: true };
  }

  async provisionServer(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const privateKey = decrypt(server.sshKey);

    await repo.updateStatus(id, 'pending');
    await installAgent({
      host: server.ip,
      port: server.sshPort,
      username: server.sshUser,
      privateKey,
    });
    await repo.updateStatus(id, 'active');
    return { provisioned: true };
  }

  async pingAgent(id: string, userId: string) {
    const server = await repo.findById(id, userId);
    if (!server) throw new NotFoundError('Server');
    const alive = await agentService.ping(server.ip);
    return { alive };
  }

  private async testAndSetStatus(
    id: string,
    ip: string,
    port: number,
    username: string,
    privateKey: string,
  ) {
    try {
      await testSshConnection({ host: ip, port, username, privateKey });
      await repo.updateStatus(id, 'active');
    } catch {
      await repo.updateStatus(id, 'error');
    }
  }
}
