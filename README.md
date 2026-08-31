# FinLife Tracker

<div align="center">

![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline%20Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

<br />

**A Full-Stack Personal Finance & Holistic Lifestyle Management Platform**

*Track expenses, manage multi-currency wallets, optimize debt payoff strategies, and correlate financial behavior with sleep, stress, and daily wellbeing.*

</div>

---

## 🌟 Overview

**FinLife Tracker** bridges the gap between quantitative financial tracking and qualitative lifestyle well-being. Built with modern TypeScript, React, and Supabase, it provides a high-performance, mobile-first experience designed to help users understand not only *where* their money goes, but *how* their daily mood, habits, and physical health influence their spending patterns.

---

## 🚀 Core Features (The "Wow" Factor)

### 📱 Offline-Ready Progressive Web App (PWA)
- **Installable Experience**: Install directly to home screens on iOS and Android with full standalone app display.
- **Resilient Offline Architecture**: Client-side caching and local storage persistence allow uninterrupted transaction logging even without active network connectivity.

### 👆 Native-Like Mobile UX
- **Fluid Gesture Navigation**: Integrated swipe gestures via `react-swipeable` allowing seamless view switching (Dashboard, Transactions, Holistic Diary, Wallets, Analytics, Debts, Rules, Security).
- **Responsive Navigation**: Adaptive desktop sidebar and ergonomic mobile bottom navigation bar with safe-area padding.
- **Hardware-Accelerated Transitions**: Powered by `motion/react` with spring physics and zero layout jitter.

### ⚡ Smart Natural Language Data Entry & Inline Math
- **Natural Language Parsing**: Type shorthand expressions like `"dinner with team 45.50 food"` or `"gym membership 60 health"` to instantly auto-populate descriptions, amounts, and categories.
- **Inline Math Calculator**: Evaluate arithmetic expressions directly within the amount field (e.g., `120/4 + 15*2`) with instant live previews.
- **Dynamic Keyword Rules Engine**: Define customizable regex and keyword rules to categorize recurring merchants automatically.

### 🌗 System-Aware Dark Mode with Anti-FOUC
- **Tailwind CSS v4 Class Strategy**: Seamless toggling between `Light`, `Dark`, and `System Default` themes using the curated `Stone` aesthetic palette.
- **Zero Flash of Unstyled Content (Anti-FOUC)**: Synchronous `<head>` script evaluates `localStorage` and `prefers-color-scheme` before DOM rendering.

### 🧘 Holistic Lifestyle Diary
- **Mind-Money Correlation**: Log daily sleep duration, stress levels, physical activity, and mood alongside financial outlays.
- **Behavioral Insights**: Identify lifestyle triggers linked to impulse spending and track holistic wellness scores over time.

### 💳 Comprehensive Debt Engine & Wealth Management
- **Snowball & Avalanche Payoff Models**: Compare interest savings and payoff timelines between lowest-balance-first and highest-APR-first repayment strategies.
- **Multi-Currency Wallets**: Manage cash, bank accounts, credit lines, and investment accounts with transfer tracking and reconciliation tools.

---

## 🏗️ Architecture & Performance Highlights

### ⚡ Frontend Engineering
```
src/
├── components/          # Extracted, reusable UI elements & modals
│   ├── AuthModal.tsx
│   ├── DebtCardItem.tsx
│   ├── InlineMathInput.tsx
│   ├── Navbar.tsx
│   ├── TransactionForm.tsx
│   └── WalletPopupModal.tsx
├── context/             # State management & reactive stores
├── hooks/               # Custom hooks for strict Separation of Concerns
│   ├── useSupabaseAuth.ts
│   └── useTheme.ts
├── types/               # Strict TypeScript interfaces & domain models
└── views/               # Route views with lazy code-splitting
    ├── AnalyticsView.tsx
    ├── DebtsView.tsx
    ├── DiaryView.tsx
    ├── RulesView.tsx
    ├── SecurityView.tsx
    ├── TransactionsView.tsx
    └── WalletsView.tsx
```

- **Route-Level Code Splitting**: Non-critical views (`AnalyticsView`, `DebtsView`, `RulesView`, `SecurityView`, `DiaryView`) are loaded on-demand via `React.lazy()` and wrapped in `Suspense` with bespoke skeleton loaders.
- **Aggressive Memoization**: High-frequency financial aggregates, rolling balance calculations, and multi-filter queries leverage `useMemo` and `useCallback` to prevent unnecessary recalculations.
- **Modular Custom Hooks**: Encapsulated state and lifecycle logic (e.g., authentication flow, session tracking, theme listener) ensures clean UI components.

### 🔒 Backend & Security Architecture
- **Supabase Realtime Sync**: Bi-directional data synchronization keeps multiple tabs and devices up-to-date in real time.
- **PostgreSQL Row-Level Security (RLS)**: Enforces tenant isolation at the database layer ensuring users can only read and mutate their own financial data.
- **Multi-Device Session Telemetry**: Device session tracking with one-click remote session revocation.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework & UI** | React 18, TypeScript, Tailwind CSS v4, Lucide React, Motion |
| **Build & Tooling** | Vite, ESBuild, PostCSS, TypeScript Compiler |
| **Data & Auth** | Supabase (PostgreSQL, Realtime Engine, GoTrue Auth) |
| **Mobile & Gestures** | PWA Service Worker, Web App Manifest, React Swipeable |
| **Data Visualization**| Recharts, SVG Gauge Visualizers, Trend Sparklines |

---

## 💻 Local Development Setup

Follow these steps to run FinLife Tracker locally:

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **yarn** / **pnpm**
- A **Supabase** project (optional for local fallback mode, required for cloud sync)

### 2. Clone the Repository
```bash
git clone https://github.com/your-username/finlife-tracker.git
cd finlife-tracker
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note**: If Supabase keys are not provided, FinLife Tracker automatically operates in **Local Storage Mode**, allowing complete testing and offline data persistence.

### 5. Start the Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### 6. Build for Production
```bash
# Typecheck & build static bundle
npm run build

# Run TypeScript linter
npm run lint
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
