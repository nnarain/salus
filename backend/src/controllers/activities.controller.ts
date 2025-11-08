import { Request, Response } from 'express';
import { pool } from '../config/database';

export const getActivities = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM activities';
    const params: any[] = [];

    if (startDate && endDate) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(startDate, endDate);
    }

    query += ' ORDER BY date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { date, activity_type, duration_minutes, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO activities (date, activity_type, duration_minutes, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [date, activity_type, duration_minutes, notes]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: 'Failed to create activity entry' });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, activity_type, duration_minutes, notes } = req.body;

    const result = await pool.query(
      `UPDATE activities
       SET date = $1, activity_type = $2, duration_minutes = $3, notes = $4
       WHERE id = $5
       RETURNING *`,
      [date, activity_type, duration_minutes, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity entry not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating activity:', error);
    res.status(500).json({ error: 'Failed to update activity entry' });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM activities WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity entry not found' });
    }

    res.json({ message: 'Activity entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: 'Failed to delete activity entry' });
  }
};
