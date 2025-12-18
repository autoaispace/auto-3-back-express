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

// 确保 SITE_URL 没有尾部斜杠，然后构建 redirect URI
const cleanSiteUrl = SITE_URL.replace(/\/$/, '');
const REDIRECT_URI = `${cleanSiteUrl}/auth/callback`;

// 打印 redirect URI 用于调试（仅在开发环境）
if (process.env.NODE_ENV !== 'production') {
  console.log('🔐 Google OAuth Redirect URI:', REDIRECT_URI);
  console.log('📝 Make sure this URI is registered in Google Cloud Console');
}

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
        console.log('🔐 Google OAuth callback received');
        const { id, displayName, emails, photos } = profile;
        const email = emails?.[0]?.value;
        const avatar = photos?.[0]?.value;

        console.log('📧 Google profile data:', { 
          email, 
          displayName, 
          googleId: id, 
          hasAvatar: !!avatar 
        });

        if (!email) {
          console.error('❌ No email found in Google profile');
          return done(new Error('No email found in Google profile'), undefined);
        }

        // Try to find existing user by listing users and filtering by email
        // Note: Supabase Admin API doesn't have getUserByEmail, so we use listUsers
        let supabaseUserId: string | null = null;

        try {
          const { data: usersList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (!listError && usersList?.users) {
            const existingUser = usersList.users.find(u => u.email === email);
            if (existingUser) {
              supabaseUserId = existingUser.id;
            }
          }
        } catch (error) {
          console.warn('Error listing users, will try to create new user:', error);
        }

        if (!supabaseUserId) {
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

        if (!supabaseUserId) {
          return done(new Error('Failed to get or create Supabase user ID'), undefined);
        }

        // Save/Update user in MongoDB
        try {
          console.log('💾 Saving user to MongoDB...');
          const db = await getDatabase();
          const usersCollection = db.collection('users');

          const userData = {
            email,
            name: displayName,
            avatar: avatar,
            googleId: id,
            supabaseUserId,
            lastLogin: new Date(),
            updatedAt: new Date(),
          };

          const result = await usersCollection.updateOne(
            { email },
            {
              $set: userData,
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            { upsert: true }
          );

          console.log('✅ MongoDB save result:', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedCount: result.upsertedCount,
            upsertedId: result.upsertedId,
          });

          // Verify the user was saved
          const savedUser = await usersCollection.findOne({ email });
          if (savedUser) {
            console.log('✅ User verified in MongoDB:', savedUser);
          } else {
            console.error('❌ User not found in MongoDB after save!');
          }
        } catch (dbError) {
          console.error('❌ MongoDB save error:', dbError);
          // Don't fail the login if MongoDB save fails, but log it
        }

        const userObject = {
          id: supabaseUserId,
          email,
          name: displayName,
          avatar,
          googleId: id,
        };

        console.log('✅ Passport strategy completed, returning user:', userObject);
        return done(null, userObject);
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
      console.log('🔄 OAuth callback handler started');
      console.log('📋 Request user:', req.user);
      console.log('📋 Request session:', req.session);
      
      const user = req.user as any;

      if (!user) {
        console.error('❌ No user in request after authentication');
        return res.redirect(`${SITE_URL}/login?error=no_user`);
      }

      console.log('✅ User found in request:', user);

      // Verify user exists in Supabase
      try {
        console.log('🔍 Verifying user in Supabase, user.id:', user.id);
        const { data: supabaseUserData, error: userError } = await supabaseAdmin.auth.admin.getUserById(user.id);
        
        if (userError || !supabaseUserData?.user) {
          console.error('❌ Get Supabase user error:', userError);
          console.error('❌ Supabase user data:', supabaseUserData);
          return res.redirect(`${SITE_URL}/login?error=user_not_found`);
        }

        console.log('✅ User verified in Supabase:', supabaseUserData.user.email);

        // Create a custom session token for the user
        // In production, you might want to use Supabase's built-in session management
        // For now, we'll create a simple token and redirect to frontend
        // Frontend should use this to create a Supabase session
        
        // Redirect to frontend with user info
        const redirectUrl = new URL(`${SITE_URL}/auth/success`);
        
        // Ensure all required fields are present
        if (!user.email || !user.id) {
          console.error('❌ Missing required user fields:', { email: user.email, id: user.id });
          return res.redirect(`${SITE_URL}/login?error=missing_user_data`);
        }
        
        redirectUrl.searchParams.set('email', user.email);
        redirectUrl.searchParams.set('name', user.name ? encodeURIComponent(user.name) : '');
        redirectUrl.searchParams.set('id', user.id);
        if (user.avatar) {
          redirectUrl.searchParams.set('avatar', encodeURIComponent(user.avatar));
        }

        console.log('✅ Login successful, redirecting to:', redirectUrl.toString());
        console.log('👤 User info being sent:', { 
          email: user.email, 
          name: user.name, 
          id: user.id, 
          avatar: user.avatar,
          hasAvatar: !!user.avatar 
        });
        console.log('🔗 Full redirect URL:', redirectUrl.toString());
        console.log('📋 URL search params:', redirectUrl.searchParams.toString());

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

// Test endpoint to check MongoDB connection and list users
router.get('/test/db', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).limit(10).toArray();
    
    res.json({
      success: true,
      message: 'Database connection successful',
      userCount: users.length,
      users: users.map(u => ({
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }))
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as authRouter };
