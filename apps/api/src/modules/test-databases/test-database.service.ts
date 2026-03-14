import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { ServerRepository } from '../servers/server.repository.js';
import { TestDatabaseRepository } from './test-database.repository.js';
import { getTestDbPlanLimits, DEMO_MAX_STORAGE_MB } from './plan-limits.js';
import { buildSshOptions, buildDemoSshOptions } from '../../utils/ssh-credentials.js';
import { encrypt, decrypt } from '../../utils/encrypt.js';
import { config } from '../../config/index.js';
import {
  createTestDbContainer,
  restartContainer,
  removeContainer,
  type TestDbType,
} from '../../services/ssh.service.js';
import { sendTestDatabaseCreatedEmail } from '../../services/email.service.js';
import { NotFoundError, AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

const serverRepo = new ServerRepository();
const repo = new TestDatabaseRepository();

const PORT_RANGES: Record<TestDbType, { start: number; end: number }> = {
  postgres: { start: 15432, end: 15531 },
  mysql: { start: 13306, end: 13405 },
  mongo: { start: 27017, end: 27116 },
};

function generatePassword(): string {
  return randomBytes(24).toString('base64').replace(/[/+=]/g, '').slice(0, 32);
}

function generateUsername(): string {
  return 'cubiq_' + randomBytes(4).toString('hex');
}

function sanitizeDbName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 63) || 'db';
}

export interface CreateTestDatabaseInput {
  type: 'postgres' | 'mysql';
  name: string;
}

export class TestDatabaseService {
  private async allocatePortForDemo(type: 'postgres' | 'mysql'): Promise<number> {
    const used = await repo.getUsedPortsForDemo();
    const { start, end } = PORT_RANGES[type];
    for (let p = start; p <= end; p++) {
      if (!used.has(p)) return p;
    }
    throw new AppError('No available port for this database type on the demo server', 503, 'NO_PORT');
  }

  async list(userId: string) {
    const list = await repo.listByUserId(userId);
    return list.map((row) => ({
      id: row.id,
      serverId: row.serverId,
      type: row.type,
      name: row.name,
      host: row.host,
      port: row.port,
      databaseName: row.databaseName,
      storageLimitMb: row.storageLimitMb,
      storageUsedMb: row.storageUsedMb,
      status: row.status,
      containerName: row.containerName,
      createdAt: row.createdAt,
    }));
  }

  async get(id: string, userId: string) {
    const row = await repo.findById(id, userId);
    if (!row) throw new NotFoundError('Test database');
    return {
      id: row.id,
      serverId: row.serverId,
      type: row.type,
      name: row.name,
      host: row.host,
      port: row.port,
      databaseName: row.databaseName,
      storageLimitMb: row.storageLimitMb,
      storageUsedMb: row.storageUsedMb,
      status: row.status,
      containerName: row.containerName,
      createdAt: row.createdAt,
    };
  }

  async create(userId: string, input: CreateTestDatabaseInput) {
    const limits = await getTestDbPlanLimits(userId);
    const count = await repo.countByUserId(userId);
    if (count >= limits.maxDatabases) {
      throw new AppError(
        `Plan limit: maximum ${limits.maxDatabases} database(s). Upgrade for more.`,
        403,
        'PLAN_LIMIT',
      );
    }

    const demoHost = config.TEST_DATABASE_HOST;
    const opts = buildDemoSshOptions();
    if (!demoHost?.trim() || !opts) {
      throw new AppError(
        'Demo databases are not configured on this platform. Contact support.',
        503,
        'DEMO_NOT_CONFIGURED',
      );
    }

    const port = await this.allocatePortForDemo(input.type);
    const password = generatePassword();
    const username = generateUsername();
    const databaseName = sanitizeDbName(input.name);
    const storageLimitMb = DEMO_MAX_STORAGE_MB;

    const row = await repo.create({
      userId,
      serverId: null,
      type: input.type,
      name: input.name,
      host: demoHost,
      port,
      username,
      password: encrypt(password),
      databaseName,
      storageLimitMb,
      status: 'creating',
      containerName: null,
    });

    const shortId = row.id.replace(/-/g, '').slice(0, 8);
    const containerName = `cubiq-db-${userId.slice(0, 8)}-${shortId}`;

    try {
      await createTestDbContainer(opts, {
        type: input.type,
        containerName,
        port,
        username,
        password,
        databaseName,
        storageLimitMb,
      });
      await repo.updateContainerAndStatus(row.id, userId, { containerName, status: 'running' });
    } catch (err) {
      logger.error({ err, testDbId: row.id }, 'Test DB container creation failed');
      await repo.updateStatus(row.id, userId, 'error');
      throw err;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    });
    if (user?.email) {
      sendTestDatabaseCreatedEmail({
        to: user.email,
        dbName: input.name,
        type: input.type,
        host: demoHost,
        port,
        username,
        password,
        databaseName,
        storageLimitMb,
      }).catch((err) => logger.warn({ err, testDbId: row.id }, 'Test DB email send failed'));
    }

    return this.get(row.id, userId);
  }

  private async getSshOptsForRow(row: { serverId: string | null }): Promise<ReturnType<typeof buildSshOptions> | null> {
    if (row.serverId) {
      const server = await serverRepo.findByIdUnscoped(row.serverId);
      return server ? buildSshOptions(server) : null;
    }
    return buildDemoSshOptions();
  }

  async delete(id: string, userId: string) {
    const row = await repo.findById(id, userId);
    if (!row) throw new NotFoundError('Test database');

    if (row.containerName) {
      const opts = await this.getSshOptsForRow(row);
      if (opts) {
        try {
          await removeContainer(opts, row.containerName);
        } catch (err) {
          logger.warn({ err, containerName: row.containerName }, 'Container remove failed');
        }
      }
    }
    await repo.delete(id, userId);
  }

  async restart(id: string, userId: string) {
    const row = await repo.findById(id, userId);
    if (!row) throw new NotFoundError('Test database');
    if (!row.containerName) throw new AppError('No container associated', 400);
    const opts = await this.getSshOptsForRow(row);
    if (!opts) throw new AppError('Server not available for this database', 503);
    await restartContainer(opts, row.containerName);
    await repo.updateStatus(id, userId, 'running');
    return this.get(id, userId);
  }

  /** Updates stored credentials. Container-side password change (exec) can be added later for immediate effect. */
  async resetPassword(id: string, userId: string) {
    const row = await repo.findById(id, userId);
    if (!row) throw new NotFoundError('Test database');
    const newPassword = generatePassword();
    await repo.updatePassword(id, userId, encrypt(newPassword));
    return this.getConnectionDetails(id, userId);
  }

  async getConnectionDetails(id: string, userId: string) {
    const row = await repo.findById(id, userId);
    if (!row) throw new NotFoundError('Test database');
    const password = decrypt(row.password);
    return {
      host: row.host,
      port: row.port,
      username: row.username,
      password,
      databaseName: row.databaseName,
    };
  }
}
