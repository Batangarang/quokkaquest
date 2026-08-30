import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@quokkaquest/shared';
import { pool } from '../../db/pool';
import { env } from '../../config/env';
import { ApiError } from '../../middleware/error-handler';

interface UserRow {
  id: string;
  household_id: string;
  role: UserRole;
  display_name: string;
  password_hash: string;
}

// Login is the one place we look a user up before we have a household context —
// by definition we don't know their household until we find their account, so this
// query is intentionally not routed through withHouseholdContext/RLS.
// Username (not email) is the login handle for all accounts, since child accounts
// don't have email addresses — see docs/multi-tenant-gdpr-plan.md §3.1.
export async function login(username: string, password: string) {
  const { rows } = await pool.query<UserRow>(
    `SELECT id, household_id, role, display_name, password_hash
     FROM users WHERE username = $1`,
    [username],
  );

  const user = rows[0];
  if (!user) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid username or password');
  }

  const token = jwt.sign(
    { sub: user.id, householdId: user.household_id, role: user.role },
    env.JWT_SECRET,
    // @types/jsonwebtoken types expiresIn as a branded duration-string type, not
    // plain string — env.JWT_EXPIRES_IN is zod-validated as a string, so this is
    // just a type-shape mismatch, not a real risk (jwt.sign accepts any ms-style
    // string like '7d' at runtime).
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );

  return {
    token,
    user: {
      id: user.id,
      displayName: user.display_name,
      role: user.role,
      householdId: user.household_id,
    },
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}
