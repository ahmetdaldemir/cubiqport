import { FastifyInstance } from 'fastify';
import {
  listTestDatabases,
  getTestDatabase,
  createTestDatabase,
  deleteTestDatabase,
  restartTestDatabase,
  resetTestDatabasePassword,
  getTestDatabaseConnection,
} from './test-database.controller.js';

type IdParam = { Params: { id: string } };

export async function testDatabaseRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get('/', auth, listTestDatabases);
  fastify.get<IdParam>('/:id', auth, getTestDatabase);
  fastify.post('/', auth, createTestDatabase);
  fastify.delete<IdParam>('/:id', auth, deleteTestDatabase);
  fastify.post<IdParam>('/:id/restart', auth, restartTestDatabase);
  fastify.post<IdParam>('/:id/reset-password', auth, resetTestDatabasePassword);
  fastify.get<IdParam>('/:id/connection', auth, getTestDatabaseConnection);
}
