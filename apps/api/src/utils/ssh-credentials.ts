import { decrypt } from './encrypt.js';
import type { SshConnectionOptions } from '../services/ssh.service.js';

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
