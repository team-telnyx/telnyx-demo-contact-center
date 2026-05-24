import type { Request, Response, NextFunction } from 'express';

// Track failed login attempts per IP with progressive lockout
const failedAttempts = new Map<string, { count: number; lockedUntil: number | null }>();

export function loginAttemptLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip;
  const entry = failedAttempts.get(ip!);

  // If locked
  if (entry && entry.lockedUntil && Date.now() < entry.lockedUntil) {
    const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({ error: `Account temporarily locked. Try again in ${remaining}s` });
  }

  // Clean up expired locks
  if (entry && entry.lockedUntil && Date.now() >= entry.lockedUntil) {
    failedAttempts.delete(ip!);
  }

  next();
}

export function recordFailedLogin(ip: string) {
  const entry = failedAttempts.get(ip) || { count: 0, lockedUntil: null };
  entry.count++;

  // Progressive lockout: 5 failures = 1min, 10 = 5min, 15 = 15min, 20 = 1hr
  if (entry.count >= 20) entry.lockedUntil = Date.now() + 3600000;
  else if (entry.count >= 15) entry.lockedUntil = Date.now() + 900000;
  else if (entry.count >= 10) entry.lockedUntil = Date.now() + 300000;
  else if (entry.count >= 5) entry.lockedUntil = Date.now() + 60000;

  failedAttempts.set(ip, entry);
}

export function recordSuccessfulLogin(ip: string) {
  failedAttempts.delete(ip);
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of failedAttempts) {
    if (entry.lockedUntil && now >= entry.lockedUntil) {
      failedAttempts.delete(ip);
    }
  }
}, 1800000);
