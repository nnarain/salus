import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { BiometricEntry, ActivityEntry, StressEntry } from '@/lib/types';

type DataType = 'biometric' | 'activity' | 'stress';

function formatCSV(data: (BiometricEntry | ActivityEntry | StressEntry)[], dataType: DataType): string {
  if (data.length === 0) {
    // Return empty CSV with headers
    switch (dataType) {
      case 'biometric':
        return 'date,metric_type,value,unit,notes\n';
      case 'activity':
        return 'date,activity_name,activity_type,effort_level,duration_minutes,notes\n';
      case 'stress':
        return 'date,stress_level,notes\n';
      default:
        return '';
    }
  }

  let csvContent = '';

  switch (dataType) {
    case 'biometric': {
      csvContent = 'date,metric_type,value,unit,notes\n';
      const biometrics = data as BiometricEntry[];
      biometrics.forEach((entry) => {
        csvContent += `${entry.date},${entry.metric_type},${entry.value},${entry.unit},${entry.notes || ''}\n`;
      });
      break;
    }
    case 'activity': {
      csvContent = 'date,activity_name,activity_type,effort_level,duration_minutes,notes\n';
      const activities = data as ActivityEntry[];
      activities.forEach((entry) => {
        csvContent += `${entry.date},${entry.activity_name},${entry.activity_type},${entry.effort_level},${entry.duration_minutes || ''},${entry.notes || ''}\n`;
      });
      break;
    }
    case 'stress': {
      csvContent = 'date,stress_level,notes\n';
      const stress = data as StressEntry[];
      stress.forEach((entry) => {
        csvContent += `${entry.date},${entry.stress_level},${entry.notes || ''}\n`;
      });
      break;
    }
  }

  return csvContent;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dataType = searchParams.get('dataType') as DataType;

    if (!dataType || !['biometric', 'activity', 'stress'].includes(dataType)) {
      return NextResponse.json(
        { error: 'Invalid or missing dataType parameter. Must be one of: biometric, activity, stress' },
        { status: 400 }
      );
    }

    let data: (BiometricEntry | ActivityEntry | StressEntry)[] = [];
    let tableName = '';

    switch (dataType) {
      case 'biometric':
        tableName = 'biometrics';
        break;
      case 'activity':
        tableName = 'activities';
        break;
      case 'stress':
        tableName = 'stress';
        break;
    }

    const { data: fetchedData, error } = await supabase
      .from(tableName)
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data', details: error.message },
        { status: 500 }
      );
    }

    data = fetchedData || [];

    const csvContent = formatCSV(data, dataType);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${dataType}-data-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export data' },
      { status: 500 }
    );
  }
}
