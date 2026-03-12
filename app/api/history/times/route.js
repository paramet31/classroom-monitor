import { NextResponse } from 'next/server';
import { getAvailableSnapshotTimes } from '../../../../lib/snapshotLogger';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
        return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    try {
        const times = getAvailableSnapshotTimes(dateStr);
        return NextResponse.json({ times });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch available snapshot times' }, { status: 500 });
    }
}
