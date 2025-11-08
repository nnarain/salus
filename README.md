# Health Tracker

A modern, self-hosted personal health tracking web application built with React, Node.js, and PostgreSQL.

## Features

- 📊 **Biometrics Tracking**: Monitor weight, BMI, body fat percentage, and muscle mass with interactive charts
- 🏃 **Activity Logging**: Track daily activities and exercises with duration and notes
- 🍽️ **Meal & Calorie Tracking**: Log meals with detailed nutritional information
- 📈 **Visual Analytics**: View trends with beautiful charts powered by Recharts
- 🤖 **AI Meal Planning**: Get personalized meal suggestions and nutrition advice using OpenAI
- 🍲 **Mealie Integration**: Connect to Mealie for recipe management and nutrition data
- 🐳 **Docker Ready**: Full Docker and Docker Compose setup for easy deployment
- 💻 **Dev Container**: VSCode dev container configuration for instant development environment

## Tech Stack

### Frontend
- React 19 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Recharts for data visualization
- Axios for API calls
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL database
- OpenAI integration for AI features
- Mealie API integration

### DevOps
- Docker & Docker Compose
- Nginx for production frontend serving
- VSCode Dev Container support

## Quick Start

### Prerequisites

- Docker and Docker Compose
- (Optional) OpenAI API key for AI features
- (Optional) Mealie instance for recipe integration

### Installation

1. Clone the repository:
```bash
git clone https://github.com/nnarain/health-tracker.git
cd health-tracker
```

2. Create environment file:
```bash
cp backend/.env.example backend/.env
```

3. Edit `backend/.env` and add your API keys:
```env
OPENAI_API_KEY=your_openai_api_key_here
MEALIE_BASE_URL=http://mealie:9000
MEALIE_API_TOKEN=your_mealie_token_here
```

4. Start the application:
```bash
docker-compose up -d
```

5. Access the application:
- Frontend: http://localhost
- Backend API: http://localhost:3000
- (Optional) Mealie: http://localhost:9000

## Development

### Using VSCode Dev Container

1. Open the project in VSCode
2. Install the "Remote - Containers" extension
3. Click "Reopen in Container" when prompted
4. The dev environment will be automatically set up

### Local Development

#### Backend

```bash
cd backend
npm install
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (.env)

```env
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=health_tracker
DB_USER=postgres
DB_PASSWORD=postgres
OPENAI_API_KEY=your_key_here
MEALIE_BASE_URL=http://mealie:9000
MEALIE_API_TOKEN=your_token_here
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3000/api
```

## API Documentation

### Biometrics Endpoints

- `GET /api/biometrics` - Get all biometric entries
- `POST /api/biometrics` - Create new biometric entry
- `PUT /api/biometrics/:id` - Update biometric entry
- `DELETE /api/biometrics/:id` - Delete biometric entry

### Activities Endpoints

- `GET /api/activities` - Get all activities
- `POST /api/activities` - Create new activity
- `PUT /api/activities/:id` - Update activity
- `DELETE /api/activities/:id` - Delete activity

### Meals Endpoints

- `GET /api/meals` - Get all meals
- `POST /api/meals` - Create new meal
- `PUT /api/meals/:id` - Update meal
- `DELETE /api/meals/:id` - Delete meal
- `GET /api/meals/stats` - Get calorie statistics

### Mealie Integration

- `GET /api/mealie` - Get recipes from Mealie
- `GET /api/mealie/search?q=query` - Search recipes
- `GET /api/mealie/:id` - Get specific recipe

### AI Endpoints

- `POST /api/ai/meal-plan` - Generate meal plan suggestions
- `POST /api/ai/chat` - Chat with AI assistant

## Database Schema

### Biometrics Table
- id (serial)
- date (date)
- weight (decimal)
- bmi (decimal)
- body_fat_percentage (decimal)
- muscle_mass (decimal)
- notes (text)
- created_at (timestamp)

### Activities Table
- id (serial)
- date (date)
- activity_type (varchar)
- duration_minutes (integer)
- notes (text)
- created_at (timestamp)

### Meals Table
- id (serial)
- date (date)
- meal_type (varchar)
- calories (integer)
- protein (decimal)
- carbs (decimal)
- fat (decimal)
- notes (text)
- mealie_recipe_id (varchar)
- created_at (timestamp)

## Optional: Setting Up Mealie

To enable recipe integration, uncomment the Mealie service in `docker-compose.yml`:

```yaml
mealie:
  image: ghcr.io/mealie-recipes/mealie:latest
  container_name: mealie
  environment:
    PUID: 1000
    PGID: 1000
    TZ: America/New_York
    BASE_URL: http://localhost:9000
  volumes:
    - mealie_data:/app/data
  ports:
    - "9000:9000"
  networks:
    - health-tracker-network
```

Then restart the services:
```bash
docker-compose down
docker-compose up -d
```

## Screenshots

### Dashboard
View your health metrics with interactive charts showing weight trends, BMI, and calorie intake over time.

### Biometrics Tracking
Easily log and track your body measurements with a user-friendly form interface.

### Meal Tracking
Log meals with detailed nutritional information and integration with Mealie recipes.

### AI Chat
Get personalized meal planning advice and recipe suggestions from the AI assistant.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

