// Extend Express Request type to include user
import { User } from '../routes/auth';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name?: string;
      avatar?: string;
      googleId?: string;
    }
  }
}
