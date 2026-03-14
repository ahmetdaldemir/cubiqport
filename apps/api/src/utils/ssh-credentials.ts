import { decrypt } from './encrypt.js';
import type { SshConnectionOptions } from '../services/ssh.service.js';
import { config } from '../config/index.js';

export interface ServerSshFields {
  ip: string;
  sshPort: number;
  sshUser: string;
  sshAuthType: string;
  sshKey: string | null;
  sshPassword: string | null;
}

/**
 * Sunucu kaydından SSH bağlantı seçeneklerini türetir.
 * Şifrelenmiş kimlik bilgilerini çözer.
 * Tüm SSH bağlantısı gereken modüllerin ortak noktası.
 */
export function buildSshOptions(server: ServerSshFields): SshConnectionOptions {
  if (server.sshAuthType === 'password' && server.sshPassword) {
    return {
      host:     server.ip,
      port:     server.sshPort,
      username: server.sshUser,
      password: decrypt(server.sshPassword),
    };
  }
  return {
    host:       server.ip,
    port:       server.sshPort,
    username:   server.sshUser,
    privateKey: decrypt(server.sshKey ?? ''),
  };
}

/** Demo test DB sunucusu (platform host). TEST_DATABASE_HOST set ise kullanılır. */
export function buildDemoSshOptions(): SshConnectionOptions | null {
  const host = config.TEST_DATABASE_HOST;
  if (!host?.trim()) return null;
  if (config.TEST_DATABASE_SSH_PASSWORD) {
    return {
      host,
      port: config.TEST_DATABASE_SSH_PORT,
      username: config.TEST_DATABASE_SSH_USER,
      password: config.TEST_DATABASE_SSH_PASSWORD,
    };
  }
  if (config.TEST_DATABASE_SSH_PRIVATE_KEY) {
    return {
      host,
      port: config.TEST_DATABASE_SSH_PORT,
      username: config.TEST_DATABASE_SSH_USER,
      privateKey: config.TEST_DATABASE_SSH_PRIVATE_KEY,
    };
  }
  return null;
}
