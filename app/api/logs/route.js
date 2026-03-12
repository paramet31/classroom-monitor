import { NextResponse } from 'next/server';
import { getRoomIncidents } from '../../../lib/incidentLogger';

export const dynamic = 'force-dynamic';


export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');
    const date = searchParams.get('date'); // Optional: YYYY-MM-DD

    if (!roomId) {
        return NextResponse.json({ error: 'roomId parameter is required' }, { status: 400 });
    }

    try {
        const incidents = getRoomIncidents(roomId, date || null) || { incidentHistory: [], ongoingIncident: null };
        return NextResponse.json(incidents);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch incident logs' }, { status: 500 });
    }
}
