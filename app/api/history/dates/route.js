import { NextResponse } from 'next/server';
import { getAvailableSnapshotDates } from '../../../../lib/snapshotLogger';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const dates = getAvailableSnapshotDates();
        return NextResponse.json({ dates });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch available snapshot dates' }, { status: 500 });
    }
}
