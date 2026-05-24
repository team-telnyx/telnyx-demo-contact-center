import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import logger from '../middleware/errorHandler.js';
import { loginAttemptLimiter, recordFailedLogin, recordSuccessfulLogin } from '../middleware/loginLimiter.js';

/**
 * Optional auth: parse Bearer token if present, otherwise leave req.user undefined.
 * Used by /register so the first user can bootstrap, but later registrations
 * require an authenticated admin.
 */
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as any;
    } catch (_) {
      // ignore — req.user stays undefined
    }
  }
  next();
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
  role: z.enum(['admin', 'agent', 'supervisor']).default('agent'),
});

export function createAuthRouter(models: any) {
  const router = Router();

  router.post('/login', loginAttemptLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await models.User.findOne({ where: { username } });
      if (!user) {
        recordFailedLogin(req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        recordFailedLogin(req.ip);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      recordSuccessfulLogin(req.ip);

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h' },
      );

      logger.info({ userId: user.id, username }, 'User logged in');
      res.json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.post('/register', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = registerSchema.parse(req.body);

      // Bootstrap rule: if there are no users yet, allow open registration
      // (first user is forced to admin). Otherwise require an authenticated admin
      // to create new accounts.
      const userCount = await models.User.count();
      if (userCount === 0) {
        data.role = 'admin'; // bootstrap admin
      } else if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create new accounts' });
      }

      // Only admins can create admin or supervisor accounts
      if (data.role === 'admin' || data.role === 'supervisor') {
        if (!req.user || req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can create admin or supervisor accounts' });
        }
      }

      const existing = await models.User.findOne({ where: { username: data.username } });
      if (existing) return res.status(409).json({ error: 'Username already exists' });

      const hash = await bcrypt.hash(data.password, 12);
      const user = await models.User.create({
        username: data.username,
        password: hash,
        displayName: data.displayName,
        role: data.role,
      });

      // Create linked Agent record
      await models.Agent.create({
        userId: user.id,
        sipUsername: data.username,  // default sip username = login username
      });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '24h' },
      );

      logger.info({ userId: user.id, username: user.username }, 'User registered');
      res.status(201).json({ token, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues });
      next(err);
    }
  });

  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // This route is protected by authMiddleware on the parent router
      const user = await models.User.findByPk(req.user.id, {
        attributes: ['id', 'username', 'displayName', 'role'],
        include: [{ model: models.Agent, as: 'agentProfile' }],
      });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
