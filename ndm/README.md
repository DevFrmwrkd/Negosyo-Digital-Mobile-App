# Negosyo Digital - Mobile App (React Native/Expo)

This is the React Native/Expo mobile app for Negosyo Digital, converted from the Next.js web application.

## Tech Stack

- **Framework**: Expo SDK 52 with Expo Router v4
- **Language**: TypeScript
- **Authentication**: Clerk (@clerk/clerk-expo)
- **Database**: Convex (same as web app)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Storage**: Convex File Storage

## Features

- 🔐 **Authentication**: Sign in/up with email or Google OAuth
- 👤 **Onboarding**: Complete profile setup for new users
- 📊 **Dashboard**: View balance and recent submissions
- 📝 **Business Submission Flow**:
  - Step 1: Business Information
  - Step 2: Photo Upload (3-10 photos)
  - Step 3: Audio Interview Recording
  - Step 4: Review & Submit
- 📄 **Submissions Management**: View all submissions with status

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your phone (for testing)
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

## Quick Start (Run Locally)

1. **Extract the ZIP and navigate to the folder**:
   ```bash
   unzip negosyo-digital-mobile.zip
   cd mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npx expo start
   ```

4. **Run on your device**:
   - **Physical Device**: Scan the QR code with Expo Go app
   - **Android Emulator**: Press `a` in the terminal
   - **iOS Simulator**: Press `i` in the terminal (macOS only)

## Build APK for Android

### Option 1: Using EAS Build (Recommended)

1. **Login to Expo**:
   ```bash
   npx eas login
   ```

2. **Configure EAS** (if first time):
   ```bash
   npx eas build:configure
   ```

3. **Build APK**:
   ```bash
   npx eas build --platform android --profile preview
   ```

   This will build an APK in the cloud and provide a download link.

### Option 2: Local Build

```bash
npx expo run:android
```

Note: Requires Android Studio and Android SDK installed.

## Build for iOS

```bash
# For simulator
npx eas build --platform ios --profile preview

# For production (requires Apple Developer account)
npx eas build --platform ios --profile production
```

## Environment Variables

The app uses the following credentials (already configured):

- **Convex URL**: `https://diligent-ibex-454.convex.cloud`
- **Clerk Publishable Key**: `pk_test_dXByaWdodC1jYXJkaW5hbC0xNS5jbGVyay5hY2NvdW50cy5kZXYk`

## Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Entry/redirect
│   ├── (auth)/             # Auth screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── (app)/              # Protected app screens
│       ├── dashboard.tsx
│       ├── onboarding.tsx
│       ├── submissions/
│       │   ├── index.tsx
│       │   └── [id].tsx
│       └── submit/
│           ├── info.tsx
│           ├── photos.tsx
│           ├── interview.tsx
│           ├── review.tsx
│           └── success.tsx
├── convex/                 # Convex generated types
├── providers/              # React providers
├── assets/                 # Static assets
├── app.json               # Expo configuration
├── eas.json               # EAS Build configuration
├── babel.config.js        # Babel config (NativeWind)
├── metro.config.js        # Metro bundler config
├── tailwind.config.js     # Tailwind/NativeWind config
└── global.css             # Global styles
```

## Clerk OAuth Setup (For Google Sign-In)

To enable Google OAuth in the mobile app, add this redirect URL in your Clerk dashboard:

```
negosyodigital://
```

Go to: Clerk Dashboard → Configure → User & Authentication → Social Connections → Google → Redirect URIs

## Troubleshooting

### "Metro bundler not starting"
```bash
npx expo start --clear
```

### "Dependencies not found"
```bash
rm -rf node_modules
npm install
```

### "Build failing on EAS"
```bash
npx expo-doctor
npx expo install --fix
```

## Differences from Web App

| Feature | Web (Next.js) | Mobile (Expo) |
|---------|--------------|---------------|
| Navigation | Next.js App Router | Expo Router |
| Styling | Tailwind CSS | NativeWind |
| File Upload | HTML File Input | expo-image-picker |
| Audio Recording | Web Audio API | expo-av |
| Storage | sessionStorage | AsyncStorage |
| Auth | @clerk/nextjs | @clerk/clerk-expo |

## License

Private - Negosyo Digital © 2026
