import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth.js';

// Mock the User model
vi.mock('../../models/User', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

// We need to import User after mocking
import User from '../../models/User';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should pass with a valid token and set req.user', async () => {
      const secret = process.env.JWT_SECRET;
      const token = jwt.sign({ username: 'testuser' }, secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = { username: 'testuser', role: 'agent' };
      User.findOne.mockResolvedValue(mockUser);

      await authenticate(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when no token is provided', async () => {
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header has no Bearer token', async () => {
      req.headers.authorization = 'Bearer ';
      // split(' ')[1] would be '' which is falsy
      // Actually 'Bearer '.split(' ')[1] is '' which is falsy
      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for an expired token', async () => {
      const secret = process.env.JWT_SECRET;
      const token = jwt.sign({ username: 'testuser' }, secret, { expiresIn: '-1s' });
      req.headers.authorization = `Bearer ${token}`;

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Token expired' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 for an invalid token', async () => {
      req.headers.authorization = 'Bearer invalid.token.here';

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not found in database', async () => {
      const secret = process.env.JWT_SECRET;
      const token = jwt.sign({ username: 'nonexistent' }, secret, { expiresIn: '1h' });
      req.headers.authorization = `Bearer ${token}`;

      User.findOne.mockResolvedValue(null);

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should call next when user has the correct role', () => {
      req.user = { role: 'admin' };
      const middleware = authorize('admin', 'supervisor');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user has an incorrect role', () => {
      req.user = { role: 'agent' };
      const middleware = authorize('admin', 'supervisor');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user is not set', () => {
      const middleware = authorize('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should default to agent role when user has no role property', () => {
      req.user = {};
      const middleware = authorize('agent');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject when default agent role is not in allowed roles', () => {
      req.user = {};
      const middleware = authorize('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
