# InkGenius Pro Backend API2222

Express.js backend API for InkGenius Pro application.

## Features

- Email subscription management
- Google OAuth authentication
- User credits system
- **Whop payment integration** 🆕
- RESTful API endpoints
- Rate limiting
- CORS configuration
- Security middleware (Helmet)
- Request logging (Morgan)
- TypeScript support

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables template:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
   - Open `.env` file
   - Fill in all required values (see `.env.example` for reference)
   - **Important**: All environment variables are required, no default values are provided for security

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `GET /auth/google` - Initiate Google OAuth login
- `GET /auth/callback` - Google OAuth callback (handled automatically)
- `GET /auth/me` - Get current authenticated user
  - Headers: `Authorization: Bearer <token>`
  - Response:
    ```json
    {
      "success": true,
      "user": {
        "id": "user-id",
        "email": "user@example.com",
        "name": "User Name",
        "avatar": "https://..."
      }
    }
    ```
- `POST /auth/logout` - Logout user

### Payment System
- `GET /api/payment/packages` - Get available credit packages
- `POST /api/payment/create` - Create payment order
  - Headers: `Authorization: Bearer <token>`
  - Request body:
    ```json
    {
      "packageId": "credits_1000",
      "successUrl": "https://yoursite.com/success",
      "cancelUrl": "https://yoursite.com/cancel"
    }
    ```
  - Response:
    ```json
    {
      "success": true,
      "data": {
        "paymentId": "payment-id",
        "checkoutUrl": "https://whop.com/checkout/...",
        "package": {
          "id": "credits_1000",
          "name": "1000 积分",
          "credits": 1000,
          "amount": 10.00,
          "currency": "USD"
        }
      }
    }
    ```
- `GET /api/payment/{paymentId}` - Get payment details
- `GET /api/payment/user/history` - Get user payment history
- `POST /api/payment/webhook/whop` - Whop webhook handler (internal)
### Email Subscription
- `POST /api/subscribe` - Subscribe email to waitlist
  - Request body:
    ```json
    {
      "email": "user@example.com",
      "source": "inkgenius-pro纹身",
      "pageUrl": "https://inkgenius.pro/features",
      "referrer": "google.com"
    }
    ```
  - Response:
    ```json
    {
      "success": true,
      "message": "Subscription successful",
      "data": {
        "email": "user@example.com",
        "subscribedAt": "2025-01-01T00:00:00.000Z"
      }
    }
    ```

## Project Structure

```
auto-3-back-express/
├── src/
│   ├── routes/
│   │   └── subscribe.ts    # Email subscription routes
│   └── index.ts            # Main application file
├── dist/                   # Compiled JavaScript (generated)
├── .env                    # Environment variables (not in git)
├── .env.example           # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `8080` |
| `NODE_ENV` | Environment mode | No | `development` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | No | `http://localhost:5173,http://localhost:3000` |
| `SESSION_SECRET` | Session secret key | **Yes** | - |
| `SUPABASE_URL` | Supabase project URL | **Yes** | - |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | **Yes** | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | **Yes** | - |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | **Yes** | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | **Yes** | - |
| `SITE_URL` | Frontend site URL | **Yes** | - |
| `MONGODB_URI` | MongoDB connection string | **Yes** | - |
| `WHOP_API_KEY` | Whop API key for payments | **Yes** | - |
| `WHOP_WEBHOOK_SECRET` | Whop webhook secret | **Yes** | - |
| `WHOP_COMPANY_ID` | Whop company ID | **Yes** | - |

**Note**: All variables marked as "Required" must be set in your `.env` file. The application will throw an error on startup if any required variable is missing.

## Security Features

- **Helmet**: Sets various HTTP headers for security
- **Rate Limiting**: Limits requests per IP (100 requests per 15 minutes)
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Email format validation

## Google OAuth Setup

1. **Google Cloud Console Configuration**:
   - Create OAuth 2.0 credentials in Google Cloud Console
   - Set authorized redirect URI: `{SITE_URL}/auth/callback`
   - Add Client ID and Secret to `.env` file

2. **Authentication Flow**:
   - User clicks "Login" → Redirects to `/auth/google`
   - Google OAuth → Redirects to `/auth/callback`
   - Backend creates/updates user in Supabase and MongoDB
   - Redirects to frontend with user info

3. **User Storage**:
   - User data is stored in both Supabase (for auth) and MongoDB (for application data)
   - Supabase handles authentication tokens
   - MongoDB stores additional user profile data

## Development Notes

- The subscription endpoint currently logs the data to console
- User authentication is fully integrated with Supabase and MongoDB
- Google OAuth is configured and ready to use
- Session management uses Express sessions with Passport
- Consider adding refresh token handling for long-lived sessions
- **Security**: All sensitive information must be stored in `.env` file, which is excluded from Git
- **Required Variables**: The application will fail to start if any required environment variable is missing

## License

ISC
