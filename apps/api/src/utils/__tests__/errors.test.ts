import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  AgentError,
} from '../errors.js';

describe('AppError', () => {
  it('mesaj ve status code taşımalı', () => {
    const err = new AppError('Bir şeyler ters gitti', 503);
    expect(err.message).toBe('Bir şeyler ters gitti');
    expect(err.statusCode).toBe(503);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('varsayılan statusCode 500 olmalı', () => {
    const err = new AppError('Hata');
    expect(err.statusCode).toBe(500);
  });

  it('opsiyonel code alanı atanmalı', () => {
    const err = new AppError('Hata', 400, 'BAD_REQUEST');
    expect(err.code).toBe('BAD_REQUEST');
  });
});

describe('NotFoundError', () => {
  it('404 döndürmeli', () => {
    const err = new NotFoundError('Server');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Server');
    expect(err.code).toBe('NOT_FOUND');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('UnauthorizedError', () => {
  it('401 döndürmeli', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('özel mesaj alabilmeli', () => {
    const err = new UnauthorizedError('Token süresi dolmuş');
    expect(err.message).toBe('Token süresi dolmuş');
  });
});

describe('ForbiddenError', () => {
  it('403 döndürmeli', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('ConflictError', () => {
  it('409 döndürmeli', () => {
    const err = new ConflictError('E-posta zaten kayıtlı');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('E-posta zaten kayıtlı');
  });
});

describe('ValidationError', () => {
  it('422 döndürmeli', () => {
    const err = new ValidationError('Geçersiz alan');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('AgentError', () => {
  it('502 döndürmeli ve mesajı sarmalamalı', () => {
    const err = new AgentError('bağlantı zaman aşımı');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('AGENT_ERROR');
    expect(err.message).toContain('bağlantı zaman aşımı');
  });
});

describe('instanceof zincirleme', () => {
  it('tüm özel hatalar AppError\'dan türemeli', () => {
    const errors = [
      new NotFoundError('X'),
      new UnauthorizedError(),
      new ForbiddenError(),
      new ConflictError('X'),
      new ValidationError('X'),
      new AgentError('X'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toBeInstanceOf(Error);
    }
  });
});
