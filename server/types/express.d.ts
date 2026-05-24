// Extend Express Request with the decoded JWT user
interface DecodedUser {
  id: string;
  userId?: string;
  username: string;
  role: string;
  displayName?: string;
  agentId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedUser;
    }
  }
}

export {};
