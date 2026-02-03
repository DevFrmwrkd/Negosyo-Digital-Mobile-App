# Cloudflare R2 Storage Setup Guide

This guide walks you through setting up Cloudflare R2 storage for the Negosyo Digital mobile app.

## Overview

The app uses Cloudflare R2 to store:
- **Images** - Business photos (stored in `images/` folder)
- **Videos** - Interview recordings (stored in `videos/` folder)
- **Audio** - Audio interviews and transcription files (stored in `audio/` folder)

## Prerequisites

- A Cloudflare account (free tier available)
- Access to the Cloudflare dashboard

## Step 1: Create a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com)
2. Click "Sign Up" and create an account
3. Verify your email address

## Step 2: Enable R2 Storage

1. Log in to the Cloudflare dashboard
2. In the left sidebar, click **R2**
3. If prompted, add a payment method (R2 has a generous free tier: 10GB storage, 10 million Class A operations, 1 million Class B operations per month)
4. Click **Create bucket**

## Step 3: Create the R2 Bucket

1. **Bucket name**: Enter `negosyo-digital` (or your preferred name)
2. **Location**: Choose the region closest to your users (e.g., Asia Pacific for Philippines)
3. Click **Create bucket**

## Step 4: Configure Public Access (Optional but Recommended)

For faster access to files, enable public access:

1. Go to your bucket settings
2. Click on **Settings** tab
3. Under **Public access**, click **Allow Access**
4. Note the **Public bucket URL** - it will look like:
   ```
   https://pub-xxxxxxxxxxxxxxxx.r2.dev
   ```

## Step 5: Create API Credentials

1. In the Cloudflare dashboard, go to **R2** > **Overview**
2. Click **Manage R2 API Tokens** (or go to **My Profile** > **API Tokens**)
3. Click **Create API Token**
4. Select **R2 Token** template or create a custom token with:
   - **Permissions**: Object Read & Write
   - **Specify bucket(s)**: Select your `negosyo-digital` bucket
5. Click **Continue to summary** > **Create Token**
6. **IMPORTANT**: Copy and save the following credentials immediately (they won't be shown again):
   - **Access Key ID**
   - **Secret Access Key**

## Step 6: Get Your Account ID

1. In the Cloudflare dashboard, look at the URL in your browser
2. Your Account ID is in the URL: `https://dash.cloudflare.com/ACCOUNT_ID/...`
3. Alternatively, go to **R2** > **Overview** and find it in the API section

## Step 7: Configure Environment Variables in Convex

Add the following environment variables to your Convex deployment:

### Using Convex Dashboard

1. Go to your Convex dashboard: [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project
3. Go to **Settings** > **Environment Variables**
4. Add the following variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | `abc123def456...` |
| `R2_ACCESS_KEY_ID` | R2 API access key | `1234567890abcdef...` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | `abcdef1234567890...` |
| `R2_BUCKET_NAME` | Your bucket name | `negosyo-digital` |
| `R2_PUBLIC_URL` | Public bucket URL (optional) | `https://pub-xxx.r2.dev` |

### Using Convex CLI

```bash
npx convex env set R2_ACCOUNT_ID "your-account-id"
npx convex env set R2_ACCESS_KEY_ID "your-access-key-id"
npx convex env set R2_SECRET_ACCESS_KEY "your-secret-access-key"
npx convex env set R2_BUCKET_NAME "negosyo-digital"
npx convex env set R2_PUBLIC_URL "https://pub-xxx.r2.dev"
```

## Step 8: Configure CORS (Required for Browser Uploads)

1. Go to your R2 bucket in Cloudflare dashboard
2. Click **Settings** tab
3. Scroll to **CORS Policy**
4. Click **Add CORS policy** and add:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Note**: For production, replace `"*"` in `AllowedOrigins` with your specific domains.

## Step 9: Verify Setup

After configuring everything, test the setup:

1. Run your mobile app
2. Navigate to the submission flow
3. Try uploading a photo
4. Check your R2 bucket in Cloudflare dashboard - you should see files in the `images/` folder

## File Organization

Files are organized in the bucket as follows:

```
negosyo-digital/
├── images/
│   ├── 1706123456789-abc123.jpg
│   ├── 1706123456790-def456.jpg
│   └── ...
├── videos/
│   ├── 1706123456791-ghi789.mp4
│   └── ...
└── audio/
    ├── 1706123456792-jkl012.m4a
    └── ...
```

Each file is named with a timestamp and random ID for uniqueness.

## Pricing

Cloudflare R2 pricing (as of 2024):

| Resource | Free Tier | Price After Free Tier |
|----------|-----------|----------------------|
| Storage | 10 GB/month | $0.015/GB/month |
| Class A operations (writes) | 1 million/month | $4.50/million |
| Class B operations (reads) | 10 million/month | $0.36/million |
| Egress | Unlimited | Free |

**No egress fees** is a major advantage over AWS S3 and other providers.

## Troubleshooting

### Upload fails with 403 Forbidden
- Check that your API credentials are correct
- Verify the bucket name matches exactly
- Ensure the API token has write permissions

### Upload fails with CORS error
- Add the CORS policy as described in Step 8
- Make sure to save the CORS configuration

### Files not accessible after upload
- If using public access, verify the public URL is configured
- Check that `R2_PUBLIC_URL` environment variable is set correctly
- If not using public access, the app will generate signed URLs automatically

### Environment variables not working
- Make sure you've deployed your Convex functions after adding env vars
- Run `npx convex deploy` to redeploy

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Restrict CORS origins** - In production, specify exact allowed domains
3. **Use bucket-specific API tokens** - Don't use account-wide tokens
4. **Enable access logs** - Monitor for unauthorized access
5. **Set up lifecycle rules** - Delete old/unused files automatically

## Support

For issues with:
- **Cloudflare R2**: [Cloudflare Community](https://community.cloudflare.com/)
- **Convex**: [Convex Discord](https://discord.gg/convex)
- **This app**: Check the project repository issues
