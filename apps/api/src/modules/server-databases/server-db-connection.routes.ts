import { FastifyInstance } from 'fastify';
import {
  listConnections,
  createConnection,
  deleteConnection,
  listDatabases,
  listTables,
} from './server-db-connection.controller.js';

type IdParam = { Params: { id: string } };
type ConnIdParam = { Params: { id: string; connectionId: string } };
type DbNameParam = { Params: { id: string; connectionId: string; dbName: string } };

export async function serverDbConnectionRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };

  fastify.get<IdParam>('/', auth, listConnections);
  fastify.post<IdParam>('/', auth, createConnection);
  fastify.delete<ConnIdParam>('/:connectionId', auth, deleteConnection);
  fastify.get<ConnIdParam>('/:connectionId/databases', auth, listDatabases);
  fastify.get<DbNameParam>('/:connectionId/databases/:dbName/tables', auth, listTables);
}
