import type { ActiveSession } from '../security/session.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireSession / optionalSession. */
      auth?: ActiveSession;
    }
  }
}

export {};
