# CSV Import Format Documentation

This document describes the expected CSV format for importing biometric, activity, and stress data into the Health Tracker application.

## General Guidelines

- The first row of your CSV file must contain column headers (field names)
- Field names are case-sensitive and must match exactly as specified below
- Fields are comma-separated
- Empty optional fields should be left blank, but commas must be present to maintain structure
- Dates must be in ISO format: `YYYY-MM-DD` (e.g., `2024-01-15`)
- Do not include extra spaces around values unless they are part of the data
- Save your file with `.csv` extension

## Biometric Data Format

### Required Fields
- `date` - Date of measurement in YYYY-MM-DD format
- `metric_type` - Type of biometric measurement (see allowed values below)
- `value` - Numeric value of the measurement
- `unit` - Unit of measurement (see allowed values below)

### Optional Fields
- `notes` - Additional notes or comments about the measurement

### Allowed Metric Types and Units

| metric_type | Allowed units |
|------------|---------------|
| `weight` | `kg`, `lbs` |
| `waistline` | `cm`, `inches` |
| `body_fat_percentage` | `%` |

### Example CSV

```csv
date,metric_type,value,unit,notes
2024-01-15,weight,75.5,kg,Morning weight
2024-01-15,waistline,85,cm,
2024-01-16,body_fat_percentage,18.5,%,After workout
2024-01-17,weight,75.2,kg,
2024-01-18,waistline,84.5,cm,Measured after breakfast
```

## Activity Data Format

### Required Fields
- `date` - Date of activity in YYYY-MM-DD format
- `activity_name` - Name of the activity (e.g., "Running", "Weight Training")
- `activity_type` - Type of activity: either `strength` or `cardio`
- `effort_level` - Effort level on a scale of 1-10 (integer)

### Optional Fields
- `duration_minutes` - Duration of activity in minutes (integer)
- `notes` - Additional notes about the activity

### Validation Rules
- `activity_type` must be exactly `strength` or `cardio`
- `effort_level` must be an integer between 1 and 10 (inclusive)
- `duration_minutes` if provided, must be a positive integer

### Example CSV

```csv
date,activity_name,activity_type,effort_level,duration_minutes,notes
2024-01-15,Running,cardio,7,30,Morning run in the park
2024-01-15,Weight Training,strength,8,45,Upper body workout
2024-01-16,Cycling,cardio,6,60,Leisurely ride
2024-01-17,Yoga,strength,5,40,
2024-01-18,HIIT,cardio,9,25,High intensity interval training
```

## Stress Data Format

### Required Fields
- `date` - Date of stress level recording in YYYY-MM-DD format
- `stress_level` - Stress level on a scale of 1-10 (integer)

### Optional Fields
- `notes` - Additional notes about stress factors or feelings

### Validation Rules
- `stress_level` must be an integer between 1 and 10 (inclusive)
  - 1-3: Low stress
  - 4-7: Moderate stress
  - 8-10: High stress

### Example CSV

```csv
date,stress_level,notes
2024-01-15,3,Relaxed day at home
2024-01-16,7,Busy at work with deadlines
2024-01-17,5,Normal day
2024-01-18,8,Stressful meeting and tight deadline
2024-01-19,4,Better after completing project
```

## Common Issues and Troubleshooting

### Issue: "CSV file must have at least a header row and one data row"
**Solution:** Make sure your CSV file has at least two rows - one for headers and one with data.

### Issue: "Invalid [type] record"
**Solution:** Check that all required fields are present and that the values match the expected format:
- Dates are in YYYY-MM-DD format
- Numeric values don't contain non-numeric characters
- Enum values (like activity_type) match exactly (case-sensitive)
- Integer values (like effort_level, stress_level) are within the valid range

### Issue: Records are being skipped
**Solution:** The import process will skip invalid records and report how many were skipped. Check the following:
- All required fields are present
- Field values match the validation rules
- There are no extra commas or missing commas in your CSV
- Quotes are properly balanced if you have values containing commas

### Issue: Date format errors
**Solution:** Dates must be in ISO format: YYYY-MM-DD
- ✅ Correct: `2024-01-15`
- ❌ Incorrect: `01/15/2024`, `15-01-2024`, `Jan 15, 2024`

## Tips for Creating CSV Files

1. **Use a spreadsheet application** - Excel, Google Sheets, or LibreOffice Calc can export to CSV format
2. **Check your export settings** - When exporting to CSV, use comma as the delimiter (not semicolon or tab)
3. **Test with a small file first** - Try importing 2-3 records before importing a large dataset
4. **Keep a backup** - Save your original CSV file before importing, in case you need to make corrections
5. **Use plain text editors carefully** - If editing CSV in a text editor, be careful with commas and quotes

## Import Process

1. Click the **Import Data** icon (cloud with arrow) in the top-right corner of the application
2. Select the data type you want to import (Biometric, Activity, or Stress)
3. Review the format example shown in the dialog
4. Click "Select CSV File" and choose your file
5. Click "Import Data" to begin the import
6. Review the import results:
   - Number of records successfully imported
   - Number of records skipped due to errors

The import process will validate each record and skip any that don't meet the requirements. Successfully imported records will be immediately available in the application.
