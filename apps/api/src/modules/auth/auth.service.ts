import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { ConflictError, UnauthorizedError } from '../../utils/errors.js';
import { BillingService } from '../billing/billing.service.js';
import type { LoginInput, RegisterInput } from '@cubiqport/shared';

const SALT_ROUNDS = 12;
const billingService = new BillingService();

export class AuthService {
  async register(input: RegisterInput) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (existing) throw new ConflictError('Email already registered');

    const hash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const [user] = await db
      .insert(users)
      .values({ email: input.email, password: hash })
      .returning({ id: users.id, email: users.email, role: users.role });

    // Initialize 7-day trial + Stripe customer (async, non-blocking)
    billingService.initUserBilling(user.id, user.email).catch(() => {});

    return user;
  }

  async login(input: LoginInput) {
    const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
    if (!user) throw new UnauthorizedError('Invalid email or password');

    const valid = await bcrypt.compare(input.password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    return { id: user.id, email: user.email, role: user.role };
  }

  async getById(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { id: true, email: true, role: true, createdAt: true },
    });
  }
}
