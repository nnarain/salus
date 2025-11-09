# Database Migrations

This directory contains SQL migration files for the Supabase database.

## Running Migrations

### Option 1: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

### Option 2: Manually via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the content of each migration file
4. Execute the SQL

### Option 3: Using Supabase Client

You can also run the migration SQL through the Supabase JavaScript client if needed.

## Migration Files

- `001_create_biometrics_table.sql`: Creates the biometrics table for storing health measurements like weight and waistline

## Schema

### biometrics Table

Stores various biometric measurements.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| created_at | TIMESTAMP WITH TIME ZONE | Timestamp when record was created |
| date | DATE | Date of the measurement |
| metric_type | VARCHAR(50) | Type of biometric (e.g., 'weight', 'waistline') |
| value | DECIMAL(10, 2) | Numeric value of the measurement |
| unit | VARCHAR(20) | Unit of measurement (e.g., 'kg', 'lbs', 'cm', 'inches') |
| notes | TEXT | Optional notes about the measurement |

**Indexes:**
- `idx_biometrics_date`: Index on date column for faster queries
- `idx_biometrics_metric_type`: Index on metric_type for faster filtering
