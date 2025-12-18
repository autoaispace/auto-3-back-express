import { Router, Request, Response } from 'express';

const router = Router();

interface SubscribeRequest {
  email: string;
  source: string;
  pageUrl: string;
  referrer: string;
}

// POST /api/subscribe
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, source, pageUrl, referrer }: SubscribeRequest = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Here you can add your email subscription logic
    // For example: save to database, send to email service, etc.
    console.log('Subscription request:', {
      email,
      source: source || 'unknown',
      pageUrl: pageUrl || 'unknown',
      referrer: referrer || 'direct',
      timestamp: new Date().toISOString()
    });

    // TODO: Implement actual subscription logic
    // - Save to database
    // - Send to email marketing service
    // - Send confirmation email
    // etc.

    // Success response
    res.status(200).json({
      success: true,
      message: 'Subscription successful',
      data: {
        email,
        subscribedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process subscription'
    });
  }
});

export { router as subscribeRouter };
