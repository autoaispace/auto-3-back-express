import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { subscribeRouter } from './routes/subscribe';
import { authRouter } from './routes/auth';
import { connectDatabase, closeDatabase } from './config/database';

// Load environment variables
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 8080;

// CORS 配置 - 支持多个来源
const CORS_ORIGIN_STR = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000';
const CORS_ORIGINS = CORS_ORIGIN_STR.split(',').map(origin => origin.trim());

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如移动应用或 Postman）
    if (!origin) return callback(null, true);
    
    // 检查 origin 是否在允许列表中
    if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) {
      callback(null, true);
    } else {
      callback(null, true); // 开发环境允许所有，生产环境应更严格
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is required');
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/subscribe', subscribeRouter);
app.use('/auth', authRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS Origins: ${CORS_ORIGINS.join(', ')}`);
  
  // Connect to MongoDB
  try {
    const db = await connectDatabase();
    console.log('✅ MongoDB connection established');
    
    // Test MongoDB connection by checking collections
    const collections = await db.listCollections().toArray();
    console.log('📚 Available collections:', collections.map(c => c.name));
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    console.error('⚠️  Server will continue but database operations may fail');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  await closeDatabase();
  process.exit(0);
});

export default app;
