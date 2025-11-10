# Health Tracker

Self hosted personal health tracker built with Next.js 15, Supabase, Tailwind CSS, and Recharts.

## Technology Stack

- **Next.js 15**: React framework with App Router and Server Components
- **Supabase**: Open source Firebase alternative for backend and database
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Recharts**: Composable charting library for data visualization
- **TypeScript**: Type-safe development

## Getting Started

You can run the Health Tracker in two ways:

### Option 1: Docker (Recommended - Fully Self-Hosted)

The easiest way to get started is using Docker Compose with a self-hosted Supabase instance:

1. Clone the repository:
```bash
git clone https://github.com/nnarain/health-tracker.git
cd health-tracker
```

2. Copy the environment file:
```bash
cp .env.docker.example .env
```

3. Start all services:
```bash
docker compose up -d
```

4. Access the application at http://localhost:3000

For detailed Docker setup instructions, see [DOCKER.md](DOCKER.md).

### Option 2: Local Development with Cloud Supabase

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/nnarain/health-tracker.git
cd health-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Configure Supabase:
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase project URL and anon key
   - You can get these from your Supabase project settings at https://app.supabase.com
   - Run the database migrations from `supabase/migrations/` in your Supabase SQL editor

```bash
cp .env.local.example .env.local
```

### Running the Development Server

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Building for Production

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Project Structure

```
health-tracker/
├── app/                  # Next.js app directory
│   ├── api/             # API routes
│   │   └── biometrics/  # Biometric data endpoints
│   ├── layout.tsx       # Root layout component
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # React components
│   └── BiometricForm.tsx # Form for adding biometric data
├── lib/                 # Utility functions and configurations
│   ├── supabase.ts      # Supabase client setup
│   └── types.ts         # TypeScript type definitions
├── supabase/            # Database migrations and schema
│   ├── migrations/      # SQL migration files
│   └── README.md        # Database documentation
├── public/              # Static assets
├── .env.local.example   # Environment variables template
└── package.json         # Project dependencies
```

## Features

- ✅ **Biometric Data Entry**: Add weight and waistline measurements with date and optional notes
- ✅ **Data Persistence**: Store biometric data in Supabase database
- ✅ **Extensible Design**: Database schema designed to support multiple types of health metrics
- ✅ **Responsive UI**: Beautiful, accessible form with Tailwind CSS
- ✅ **Data Visualization**: Sample charts with Recharts library
- 🚧 **User Authentication**: Coming soon
- 🚧 **Historical Data Charts**: Visualize your biometric data over time

### Biometric Data

The app currently supports tracking:
- **Weight**: Record your weight in kg or lbs
- **Waistline**: Track waist measurements in cm or inches

The database schema is extensible, making it easy to add more biometric types in the future.

## Development

The application uses:
- ESLint for code linting: `npm run lint`
- TypeScript for type checking
- Tailwind CSS for styling

## License

MIT

