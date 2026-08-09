import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@quokkaquest/shared';
import { env } from '../config/env';

export interface AuthContext {
  userId: string;
  householdId: string;
  role: UserRole;
}

// household_id is derived ONLY from the verified JWT claims below — never from a
// request param, query string, or body. See docs/multi-tenant-gdpr-plan.md §2.
declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

interface JwtClaims {
  sub: string; // user id
  householdId: string;
  role: UserRole;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice('Bearer '.length);

  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as JwtClaims;
    req.auth = {
      userId: claims.sub,
      householdId: claims.householdId,
      role: claims.role,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const GUARDIAN_ROLES: UserRole[] = ['owner', 'co-admin'];

/** Restricts a route to guardians who can create/edit/approve (owner or co-admin). */
export function requireGuardian(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !GUARDIAN_ROLES.includes(req.auth.role)) {
    return res.status(403).json({ error: 'This action requires a guardian (owner/co-admin) role' });
  }
  next();
}
