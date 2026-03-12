import { NextResponse } from 'next/server';
import { getAvailableDates } from '../../../../lib/incidentLogger';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dates = getAvailableDates();
        return NextResponse.json({ dates });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch available dates' }, { status: 500 });
    }
}
