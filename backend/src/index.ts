import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';

import biometricsRoutes from './routes/biometrics.routes';
import activitiesRoutes from './routes/activities.routes';
import mealsRoutes from './routes/meals.routes';
import mealieRoutes from './routes/mealie.routes';
import aiRoutes from './routes/ai.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/biometrics', biometricsRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/meals', mealsRoutes);
app.use('/api/mealie', mealieRoutes);
app.use('/api/ai', aiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
