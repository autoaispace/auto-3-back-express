import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { supabaseAdmin } from '../config/supabase';
import { getDatabase } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SITE_URL = process.env.SITE_URL;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('GOOGLE_CLIENT_ID environment variable is required');
}

if (!GOOGLE_CLIENT_SECRET) {
  throw new Error('GOOGLE_CLIENT_SECRET environment variable is required');
}

if (!SITE_URL) {
  throw new Error('SITE_URL environment variable is required');
}

const REDIRECT_URI = `${SITE_URL}/auth/callback`;

// Configure Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: REDIRECT_URI,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const { id, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;
        const avatar = photos?.[0]?.value;

        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        // Check if user exists in Supabase first
        const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
        
        let supabaseUserId: string;

        if (existingUser?.user) {
          // User exists in Supabase
          supabaseUserId = existingUser.user.id;
        } else {
          // New user - create in Supabase
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              full_name: displayName,
              avatar_url: avatar,
              provider: 'google',
              provider_id: id,
            },
          });

          if (createError || !newUser.user) {
            console.error('Supabase user creation error:', createError);
            return done(createError || new Error('Failed to create user'), undefined);
          }

          supabaseUserId = newUser.user.id;
        }

        // Save/Update user in MongoDB
        const db = await getDatabase();
        const usersCollection = db.collection('users');

        await usersCollection.updateOne(
          { email },
          {
            $set: {
              email,
              name: displayName,
              avatar: avatar,
              googleId: id,
              supabaseUserId,
              lastLogin: new Date(),
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        return done(null, {
          id: supabaseUserId,
          email,
          name: displayName,
          avatar,
          googleId: id,
        });
      } catch (error) {
        console.error('Passport strategy error:', error);
        return done(error, undefined);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Initiate Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/callback',
  passport.authenticate('google', { failureRedirect: `${SITE_URL}/login?error=auth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user as any;

      if (!user) {
        return res.redirect(`${SITE_URL}/login?error=no_user`);
      }

      // Verify user exists in Supabase
      try {
        const { data: supabaseUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError || !supabaseUserData?.user) {
          console.error('Get Supabase user error:', userError);
          return res.redirect(`${SITE_URL}/login?error=user_not_found`);
        }

        // Create a custom session token for the user
        // In production, you might want to use Supabase's built-in session management
        // For now, we'll create a simple token and redirect to frontend
        // Frontend should use this to create a Supabase session
        
        // Redirect to frontend with user info
        const redirectUrl = new URL(`${SITE_URL}/auth/success`);
        redirectUrl.searchParams.set('email', user.email);
        redirectUrl.searchParams.set('name', encodeURIComponent(user.name || ''));
        redirectUrl.searchParams.set('id', user.id);
        if (user.avatar) {
          redirectUrl.searchParams.set('avatar', encodeURIComponent(user.avatar));
        }

        res.redirect(redirectUrl.toString());
      } catch (error) {
        console.error('Error verifying Supabase user:', error);
        return res.redirect(`${SITE_URL}/login?error=verification_failed`);
      }
    } catch (error) {
      console.error('Callback error:', error);
      res.redirect(`${SITE_URL}/login?error=callback_failed`);
    }
  }
);

// Get current user (if authenticated)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7);
    
    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Get user data from MongoDB
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const userData = await usersCollection.findOne({ email: user.email });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || userData?.name,
        avatar: user.user_metadata?.avatar_url || userData?.avatar,
        ...userData
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

export { router as authRouter };
