import { describe, it, expect, vi, beforeEach } from 'vitest';

// encrypt modülünü mock'la — gerçek kripto işlemi gerektirmesin
vi.mock('../encrypt.js', () => ({
  decrypt: (val: string) => `decrypted:${val}`,
}));

// Mock'tan sonra import et
const { buildSshOptions } = await import('../ssh-credentials.js');

const base = {
  ip: '192.168.1.100',
  sshPort: 22,
  sshUser: 'root',
};

describe('buildSshOptions', () => {
  describe('password auth tipi', () => {
    it('şifreyi çözüp password alanına koymalı', () => {
      const opts = buildSshOptions({
        ...base,
        sshAuthType: 'password',
        sshPassword: 'encrypted_pass',
        sshKey: null,
      });

      expect(opts.host).toBe('192.168.1.100');
      expect(opts.port).toBe(22);
      expect(opts.username).toBe('root');
      expect(opts.password).toBe('decrypted:encrypted_pass');
      expect(opts.privateKey).toBeUndefined();
    });

    it('sshPassword null ise key auth\'a fallback etmeli', () => {
      const opts = buildSshOptions({
        ...base,
        sshAuthType: 'password',
        sshPassword: null,
        sshKey: 'encrypted_key',
      });

      expect(opts.privateKey).toBe('decrypted:encrypted_key');
      expect(opts.password).toBeUndefined();
    });
  });

  describe('key auth tipi', () => {
    it('private key\'i çözüp privateKey alanına koymalı', () => {
      const opts = buildSshOptions({
        ...base,
        sshAuthType: 'key',
        sshKey: 'encrypted_key',
        sshPassword: null,
      });

      expect(opts.privateKey).toBe('decrypted:encrypted_key');
      expect(opts.password).toBeUndefined();
    });

    it('sshKey null ise boş string ile decrypt çağırmalı', () => {
      const opts = buildSshOptions({
        ...base,
        sshAuthType: 'key',
        sshKey: null,
        sshPassword: null,
      });

      expect(opts.privateKey).toBe('decrypted:');
    });
  });

  describe('port ve host', () => {
    it('özel port ve kullanıcı adını doğru aktarmalı', () => {
      const opts = buildSshOptions({
        ip: '10.0.0.5',
        sshPort: 2222,
        sshUser: 'admin',
        sshAuthType: 'password',
        sshPassword: 'p',
        sshKey: null,
      });

      expect(opts.host).toBe('10.0.0.5');
      expect(opts.port).toBe(2222);
      expect(opts.username).toBe('admin');
    });
  });
});
