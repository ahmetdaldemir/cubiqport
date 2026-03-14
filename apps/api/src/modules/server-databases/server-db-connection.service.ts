import { ServerRepository } from '../servers/server.repository.js';
import { ServerDbConnectionRepository } from './server-db-connection.repository.js';
import { buildSshOptions } from '../../utils/ssh-credentials.js';
import { encrypt, decrypt } from '../../utils/encrypt.js';
import { listRemoteDatabases, listRemoteTables } from '../../services/ssh.service.js';
import { NotFoundError, AppError } from '../../utils/errors.js';

const serverRepo = new ServerRepository();
const repo = new ServerDbConnectionRepository();

export interface CreateServerDbConnectionInput {
  name: string;
  type: 'mysql' | 'postgres';
  host?: string;
  port?: number;
  username: string;
  password: string;
}

export class ServerDbConnectionService {
  async list(serverId: string, userId: string) {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');
    const list = await repo.listByServerId(serverId, userId);
    return list.map((c) => ({
      id: c.id,
      serverId: c.serverId,
      name: c.name,
      type: c.type,
      host: c.host,
      port: c.port,
      username: c.username,
      createdAt: c.createdAt,
    }));
  }

  async create(serverId: string, userId: string, input: CreateServerDbConnectionInput) {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');

    const row = await repo.create({
      serverId,
      name: input.name,
      type: input.type,
      host: input.host ?? '127.0.0.1',
      port: input.port ?? (input.type === 'mysql' ? 3306 : 5432),
      username: input.username,
      password: encrypt(input.password),
    });
    return {
      id: row.id,
      serverId: row.serverId,
      name: row.name,
      type: row.type,
      host: row.host,
      port: row.port,
      username: row.username,
      createdAt: row.createdAt,
    };
  }

  async delete(connectionId: string, userId: string) {
    const conn = await repo.findById(connectionId, userId);
    if (!conn) throw new NotFoundError('Database connection');
    await repo.delete(connectionId, userId);
  }

  async listDatabases(serverId: string, connectionId: string, userId: string): Promise<string[]> {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');
    const conn = await repo.findById(connectionId, userId);
    if (!conn || conn.serverId !== serverId) throw new NotFoundError('Database connection');

    const opts = buildSshOptions(server);
    const password = decrypt(conn.password);
    return listRemoteDatabases(opts, {
      type: conn.type,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password,
    });
  }

  async listTables(
    serverId: string,
    connectionId: string,
    database: string,
    userId: string,
  ): Promise<string[]> {
    const server = await serverRepo.findById(serverId, userId);
    if (!server) throw new NotFoundError('Server');
    const conn = await repo.findById(connectionId, userId);
    if (!conn || conn.serverId !== serverId) throw new NotFoundError('Database connection');

    const opts = buildSshOptions(server);
    const password = decrypt(conn.password);
    return listRemoteTables(
      opts,
      {
        type: conn.type,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password,
      },
      database,
    );
  }
}
