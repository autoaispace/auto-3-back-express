# InkGenius Pro Backend API

Express.js backend API for InkGenius Pro application.

## Features

- Email subscription management
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

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

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

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |

## Security Features

- **Helmet**: Sets various HTTP headers for security
- **Rate Limiting**: Limits requests per IP (100 requests per 15 minutes)
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: Email format validation

## Development Notes

- The subscription endpoint currently logs the data to console
- You need to implement actual storage logic (database, email service, etc.)
- Consider adding authentication for protected endpoints
- Add database integration for persistent storage

## License

ISC
