# Health Tracker

Self hosted personal health tracker built with Next.js 15, Supabase, Tailwind CSS, and Recharts.

## Technology Stack

- **Next.js 15**: React framework with App Router and Server Components
- **Supabase**: Open source Firebase alternative for backend and database
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Recharts**: Composable charting library for data visualization
- **TypeScript**: Type-safe development

## Getting Started

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

3. (Optional) Configure Supabase:
   - Copy `.env.local.example` to `.env.local`
   - Add your Supabase project URL and anon key
   - You can get these from your Supabase project settings at https://app.supabase.com

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
│   ├── layout.tsx       # Root layout component
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── lib/                 # Utility functions and configurations
│   └── supabase.ts      # Supabase client setup
├── public/              # Static assets
├── .env.local.example   # Environment variables template
└── package.json         # Project dependencies
```

## Features (Coming Soon)

- User authentication
- Health metrics tracking
- Data visualization with charts
- Data persistence with Supabase
- Responsive design

## Development

The application uses:
- ESLint for code linting: `npm run lint`
- TypeScript for type checking
- Tailwind CSS for styling

## License

MIT

