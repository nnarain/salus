import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'health_tracker',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export const initDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create biometrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS biometrics (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        weight DECIMAL(5, 2),
        bmi DECIMAL(4, 2),
        body_fat_percentage DECIMAL(4, 2),
        muscle_mass DECIMAL(5, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create activities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        activity_type VARCHAR(100) NOT NULL,
        duration_minutes INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create meals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        meal_type VARCHAR(50) NOT NULL,
        calories INTEGER,
        protein DECIMAL(5, 2),
        carbs DECIMAL(5, 2),
        fat DECIMAL(5, 2),
        notes TEXT,
        mealie_recipe_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};
