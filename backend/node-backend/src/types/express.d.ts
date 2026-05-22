import type { JwtPayload } from '../lib/jwt';

declare global {
  namespace Express {
    interface User extends JwtPayload {}

    interface Request {
      user?: User;
    }
  }
}

export {};
