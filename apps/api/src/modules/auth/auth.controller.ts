import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginSchema, RegisterSchema } from '@cubiqport/shared';

const authService = new AuthService();

export async function register(req: FastifyRequest, reply: FastifyReply) {
  const body = RegisterSchema.parse(req.body);
  const user = await authService.register(body);
  const token = req.server.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  return reply.status(201).send({ success: true, data: { user, token } });
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const body = LoginSchema.parse(req.body);
  const user = await authService.login(body);
  const token = req.server.jwt.sign({ sub: user.id, email: user.email, role: user.role });
  return reply.send({ success: true, data: { user, token } });
}

export async function me(req: FastifyRequest, reply: FastifyReply) {
  const user = await authService.getById(req.user.sub);
  return reply.send({ success: true, data: user });
}
