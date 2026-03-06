import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { JwtPayload } from '@cubiqport/shared';

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // EventSource SSE bağlantıları custom header gönderemez;
      // bu durumlarda token ?token= query string ile gelir.
      const queryToken = (request.query as Record<string, string>).token;
      if (queryToken && !request.headers.authorization) {
        request.headers.authorization = `Bearer ${queryToken}`;
      }
      await request.jwtVerify();

      // Süspend kontrolü (superadmin bypass)
      if ((request.user as JwtPayload).role !== 'superadmin') {
        const [user] = await db.select({ suspended: users.suspended })
          .from(users)
          .where(eq(users.id, (request.user as JwtPayload).sub))
          .limit(1);
        if (user?.suspended) {
          return reply.status(403).send({ success: false, error: 'Hesabınız askıya alınmıştır. Destek için info@cubiqport.com ile iletişime geçin.', code: 'SUSPENDED' });
        }
      }
    } catch (err) {
      if ((err as { code?: string }).code === 'SUSPENDED') throw err;
      return reply.status(401).send({ success: false, error: 'Unauthorized' });
    }
  });
}

export const authPluginModule = fastifyPlugin(authPlugin, { name: 'auth' });

// ─── Type augmentation ────────────────────────────────────────────────────────
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
