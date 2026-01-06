# Stripe Integration Setup Guide

## Overview
This app now includes a token-based subscription system with Stripe integration. Users get tokens based on their subscription tier, and each token equals 1 minute of video processing (rounded down).

## Subscription Tiers

- **Free**: 10 tokens/month (no payment required)
- **Tier 1**: $4.99/month - 100 tokens/month
- **Tier 2**: $14.99/month - 500 tokens/month
- **King**: $49.99/month - 5,000 tokens/month

## Setup Steps

### 1. Install Dependencies

Run these commands in your terminal:

```bash
cd server
npm install stripe firebase-admin

cd ../client
npm install @stripe/stripe-js react-router-dom
```

### 2. Create Stripe Products and Prices

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Create three products:
   - **Tier 1**: $4.99/month (recurring)
   - **Tier 2**: $14.99/month (recurring)
   - **King**: $49.99/month (recurring)

3. Copy the Price IDs (they start with `price_...`) for each product

### 3. Configure Environment Variables

#### Server (.env file in `server/` directory)

Add these variables:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx  # Get this from Stripe Dashboard > Developers > API keys
STRIPE_PRICE_ID_TIER1=price_xxxxxxxxxxxxx  # Replace with your Tier 1 price ID
STRIPE_PRICE_ID_TIER2=price_xxxxxxxxxxxxx  # Replace with your Tier 2 price ID
STRIPE_PRICE_ID_KING=price_xxxxxxxxxxxxx   # Replace with your King tier price ID
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx   # Get this from Stripe webhook settings
FIREBASE_PROJECT_ID=yt-censor-988e9
# Optional: If you have a Firebase service account JSON, add it as:
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

#### Client (.env file in `client/` directory)

Add these variables:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx  # Get this from Stripe Dashboard > Developers > API keys
VITE_STRIPE_PRICE_ID_TIER1=price_xxxxxxxxxxxxx  # Same as server
VITE_STRIPE_PRICE_ID_TIER2=price_xxxxxxxxxxxxx  # Same as server
VITE_STRIPE_PRICE_ID_KING=price_xxxxxxxxxxxxx   # Same as server
VITE_API_URL=http://localhost:3001  # Your server URL
```

### 4. Set Up Stripe Webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set the endpoint URL to: `https://your-domain.com/api/webhook`
   - For local testing, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3001/api/webhook`
4. Select these events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret and add it to your server `.env` as `STRIPE_WEBHOOK_SECRET`

### 5. Firebase Setup

The app uses Firebase Firestore to store user subscription data. Make sure:

1. Firebase project is set up (already configured in `client/src/firebase/config.js`)
2. Firestore is enabled in your Firebase project
3. Set up Firestore security rules to allow authenticated users to read their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only server can write
    }
  }
}
```

4. For server-side access, you can either:
   - Use Firebase Admin SDK with a service account (recommended for production)
   - Or rely on client-side Firestore (works but less secure)

### 6. Testing

1. Start the server: `cd server && npm start`
2. Start the client: `cd client && npm run dev`
3. Sign in to the app
4. Navigate to the "Plan" tab in the navbar
5. Try subscribing to a tier (use Stripe test card: `4242 4242 4242 4242`)
6. Process a video to test token deduction

## How It Works

1. **Token Calculation**: Video duration is measured in seconds, then divided by 60 and rounded down (e.g., 90 seconds = 1 token, 150 seconds = 2 tokens)

2. **Token Checking**: Before processing, the server checks if the user has enough tokens. If not, it returns an error.

3. **Token Deduction**: After successful video processing, tokens are deducted from the user's account.

4. **Monthly Reset**: Tokens reset on the first day of each month based on the user's subscription tier.

5. **Payment Flow**: 
   - User clicks "Subscribe" on a plan
   - Server creates a Stripe Checkout session
   - User is redirected to Stripe's payment page
   - After payment, Stripe sends a webhook
   - Server updates the user's subscription in Firestore

## Important Notes

- **Free users** won't see payment prompts unless they try to use the app without tokens
- Tokens are checked on both client and server side for better UX
- The server validates all requests with Firebase ID tokens
- Make sure to use test mode keys for development and switch to live keys for production

## Troubleshooting

- **"Price ID not configured"**: Make sure you've set the price IDs in both server and client `.env` files
- **Webhook not working**: Check that the webhook URL is correct and the secret matches
- **Tokens not resetting**: Check that the `nextResetDate` is being calculated correctly
- **Authentication errors**: Ensure Firebase Admin is properly initialized with correct credentials

