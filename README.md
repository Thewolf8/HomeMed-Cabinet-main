# HomeMed Cabinet

A premium offline-first household medicine management tool designed for AI-assisted analysis.

## Features

- **Dashboard**: View total medicines, expiring items, low stock alerts, and emergency readiness score
- **Add/Edit Medicines**: Comprehensive medicine form with name, dosage, form, quantity, expiration, category, and more
- **Medicine List**: Search, filter by category/expiration, sort, and expandable details
- **Emergency Readiness**: Checklist for essential emergency items
- **Export**: Export inventory as PDF, TXT, or JSON with AI analysis prompt
- **Import**: Restore medicines from JSON backup files
- **Multi-language**: Support for English, Arabic (with RTL), French, and System Default
- **Dark/Light Mode**: Toggle between dark and light themes
- **Privacy-First**: All data stored locally, no cloud, no account required

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Framer Motion animations
- jsPDF for PDF generation
- Capacitor.js for native Android app
- LocalStorage for persistence

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
# Build web app
npm run build

# Sync with Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

### Build Android APK

```bash
# Build debug APK
cd android && ./gradlew assembleDebug

# Build release APK
cd android && ./gradlew assembleRelease
```

## CI/CD with GitHub Actions

This project includes a GitHub Actions workflow that automatically builds the Android APK on every push to the `main` branch.

### Setup Instructions

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/homemed-cabinet.git
   git push -u origin main
   ```

2. **Download APK**:
   - Go to your repository on GitHub
   - Navigate to **Actions** tab
   - Click on the latest workflow run
   - Scroll down to **Artifacts** section
   - Download `debug-apk` or `release-apk`

## Project Structure

```
├── src/
│   ├── i18n/               # Multi-language translations and context
│   │   ├── translations.ts # EN, AR, FR dictionaries
│   │   └── I18nContext.tsx # RTL support, language detection
│   ├── services/           # Business logic
│   │   ├── fileSystem.ts   # Capacitor filesystem & sharing
│   │   ├── exportService.ts # PDF, TXT, JSON export
│   │   └── medicationService.ts # CRUD operations
│   ├── hooks/              # Custom React hooks
│   │   ├── useMedications.ts
│   │   └── useSettings.ts
│   ├── pages/              # Page components
│   │   ├── DashboardPage.tsx
│   │   ├── MedicinesPage.tsx
│   │   ├── AddMedicinePage.tsx
│   │   ├── EditMedicinePage.tsx
│   │   ├── ExportPage.tsx
│   │   └── SettingsPage.tsx
│   ├── components/         # Shared components
│   │   ├── MobileNav.tsx
│   │   └── Header.tsx
│   └── types/              # TypeScript types
│       └── medication.ts
├── capacitor.config.ts     # Capacitor configuration
├── .github/workflows/      # CI/CD pipeline
│   └── android-build.yml
├── tailwind.config.js
└── vite.config.ts
```

## Multi-language Support

HomeMed Cabinet supports:
- **English** (LTR)
- **Arabic (العربية)** with full RTL support
- **French (Français)**
- **System Default** (auto-detects device language)

The app dynamically injects `dir="rtl"` when Arabic is selected, with Tailwind utilities handling proper spacing, text alignment, and direction-sensitive icons.

## File Export & Sharing

On native Android:
- Uses `@capacitor/filesystem` to save files to Documents directory
- Uses `@capacitor/share` to open native Android share sheet
- Supports sharing via WhatsApp, Telegram, Email, etc.

On web:
- Falls back to standard blob download

## Privacy

- No cloud storage
- No account required
- All data stays on your device
- No built-in AI analysis
- Export your data to use with any AI assistant you trust

## License

MIT
