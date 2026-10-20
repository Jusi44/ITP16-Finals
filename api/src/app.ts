import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { env } from './env.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
    trustProxy: env.TRUST_PROXY,
  });

  await app.register(helmet);
  await app.register(cookie);
  await app.register(healthRoutes);

  return app;
}
