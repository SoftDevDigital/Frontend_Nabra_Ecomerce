import { NextResponse } from 'next/server';

// Versión fija para evitar bucles infinitos
const APP_VERSION = '1.0.0';

export async function GET() {
  try {
    return NextResponse.json({
      version: APP_VERSION,
      timestamp: Date.now(),
      buildTime: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
      }
    });
  } catch (error) {
    console.error('Error in version API:', error);
    return NextResponse.json(
      { error: 'Failed to get version info' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
}
