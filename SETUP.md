# RenalVault AI — Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Android Studio / Xcode (for local builds)
- Firebase account

---

## Step 1 — Install Dependencies

```bash
cd "renalvault AI"
npm install
```

---

## Step 2 — Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **Add project** → name it `renalvault-ai`
3. Disable Google Analytics (optional)
4. Click **Create project**

### Enable Authentication
1. In Firebase Console → **Authentication** → **Get started**
2. Enable **Email/Password** provider → Save

### Enable Firestore
1. **Firestore Database** → **Create database**
2. Choose **Start in production mode** (or test mode for development)
3. Select your region → Done
4. Go to **Rules** tab and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /reports/{reportId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### Enable Storage
1. **Storage** → **Get started** → **Next** → **Done**
2. Go to **Rules** tab and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /reports/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Get Firebase Config
1. **Project Settings** (gear icon) → **General** tab
2. Scroll to **Your apps** → click **</>** (Web app)
3. Register app name `renalvault-web` → click **Register app**
4. Copy the `firebaseConfig` object values

---

## Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your Firebase values:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=renalvault-ai.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=renalvault-ai
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=renalvault-ai.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
EXPO_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

> **Never commit your `.env` file.** It is already in `.gitignore`.

---

## Step 4 — Run in Development (Expo Go — no OCR)

```bash
npx expo start
```

Scan the QR code with **Expo Go** app. Note: OCR scanning requires a custom dev build (Step 5).

---

## Step 5 — Build with OCR Support (EAS Build)

The on-device OCR (`react-native-text-recognition`) requires a custom native build.

### 5a. Login to EAS
```bash
eas login
```

### 5b. Configure EAS project
```bash
eas build:configure
```

### 5c. Build a development client
```bash
# Android
eas build --profile development --platform android

# iOS
eas build --profile development --platform ios
```

### 5d. Start dev server with dev client
```bash
npx expo start --dev-client
```

Install the dev build APK/IPA on your device and scan the QR code.

---

## Step 6 — Production Build

```bash
# Android APK/AAB for Play Store
eas build --profile production --platform android

# iOS IPA for App Store
eas build --profile production --platform ios
```

---

## Project Structure

```
renalvault-ai/
├── app/
│   ├── _layout.tsx          # Root layout + auth guard
│   ├── index.tsx            # Splash redirect
│   ├── (auth)/
│   │   ├── login.tsx        # Login screen
│   │   └── register.tsx     # Registration screen
│   └── (tabs)/
│       ├── dashboard.tsx    # Health summary + risk indicator
│       ├── scan.tsx         # OCR scan + manual entry
│       ├── history.tsx      # Trend charts + report list
│       └── profile.tsx      # User settings
├── components/
│   ├── ui/                  # Button, Card, Badge
│   ├── RiskIndicator.tsx    # Semicircle risk gauge
│   ├── ParameterCard.tsx    # Single parameter display
│   └── TrendChart.tsx       # Line chart for trends
├── services/
│   ├── firebase.ts          # Firebase init
│   ├── auth.ts              # Auth operations
│   ├── firestore.ts         # Report CRUD
│   ├── storage.ts           # Image upload
│   └── ocr.ts               # On-device OCR
├── utils/
│   ├── ckdAnalysis.ts       # CKD-EPI + KDIGO staging
│   └── parameterParser.ts   # OCR text → parameters
├── hooks/
│   ├── useAuth.ts
│   └── useReports.ts
├── types/index.ts
└── constants/theme.ts
```

---

## Firestore Data Model

```
users/{userId}
  ├── name: string
  ├── email: string
  ├── age: number
  ├── sex: "male" | "female"
  └── createdAt: string

users/{userId}/reports/{reportId}
  ├── date: string
  ├── imageUrl?: string
  ├── rawText?: string
  ├── parameters: { creatinine?, egfr?, bun?, urea?, ... }
  ├── analysis: { ckdStage, riskLevel, riskScore, notes[], recommendations[] }
  └── createdAt: string
```

---

## Medical Parameters Analyzed

| Parameter | Unit | Normal Range |
|-----------|------|-------------|
| eGFR | mL/min/1.73m² | ≥ 60 |
| Creatinine | mg/dL | 0.6–1.35 |
| BUN | mg/dL | 7–20 |
| Urea | mg/dL | 13–43 |
| Sodium | mEq/L | 136–145 |
| Potassium | mEq/L | 3.5–5.1 |
| Phosphorus | mg/dL | 2.5–4.5 |
| Albumin | g/dL | 3.5–5.0 |
| Hemoglobin | g/dL | 12–17.5 |

## CKD Staging (KDIGO)

| Stage | eGFR | Risk |
|-------|------|------|
| 1 | ≥ 90 | Low |
| 2 | 60–89 | Low–Moderate |
| 3 | 30–59 | Moderate–High |
| 4 | 15–29 | High |
| 5 | < 15 | Critical (Kidney Failure) |

---

## Disclaimer

RenalVault AI is for **informational purposes only**. It does not provide medical diagnosis or treatment. Always consult a qualified nephrologist for kidney health concerns.
