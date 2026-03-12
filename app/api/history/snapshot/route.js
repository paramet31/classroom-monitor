import { NextResponse } from 'next/server';
import { getSnapshot } from '../../../../lib/snapshotLogger';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const timeStr = searchParams.get('time');

    if (!dateStr || !timeStr) {
        return NextResponse.json({ error: 'Date and time parameters are required' }, { status: 400 });
    }

    try {
        const rooms = getSnapshot(dateStr, timeStr);
        if (!rooms) {
            return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
        }
        return NextResponse.json({ rooms });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 });
    }
}
