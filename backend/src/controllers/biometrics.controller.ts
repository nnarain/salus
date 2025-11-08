import { Request, Response } from 'express';
import { pool } from '../config/database';

export const getBiometrics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM biometrics';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching biometrics:', error);
    res.status(500).json({ error: 'Failed to fetch biometrics' });
  }
};

export const createBiometric = async (req: Request, res: Response) => {
  try {
    const { date, weight, bmi, body_fat_percentage, muscle_mass, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO biometrics (date, weight, bmi, body_fat_percentage, muscle_mass, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [date, weight, bmi, body_fat_percentage, muscle_mass, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating biometric:', error);
    res.status(500).json({ error: 'Failed to create biometric entry' });
  }
};

export const updateBiometric = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, weight, bmi, body_fat_percentage, muscle_mass, notes } = req.body;

    const result = await pool.query(
      `UPDATE biometrics
       SET date = $1, weight = $2, bmi = $3, body_fat_percentage = $4, muscle_mass = $5, notes = $6
       WHERE id = $7
       RETURNING *`,
      [date, weight, bmi, body_fat_percentage, muscle_mass, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Biometric entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating biometric:', error);
    res.status(500).json({ error: 'Failed to update biometric entry' });
  }
};

export const deleteBiometric = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM biometrics WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Biometric entry not found' });
    }

    res.json({ message: 'Biometric entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting biometric:', error);
    res.status(500).json({ error: 'Failed to delete biometric entry' });
  }
};
