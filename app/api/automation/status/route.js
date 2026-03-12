import { NextResponse } from 'next/server';
import { getSchedulerStatus } from '../../../../lib/scheduler.js';

// GET /api/automation — check scheduler status
export async function GET() {
    try {
        const status = getSchedulerStatus();
        return NextResponse.json({
            success: true,
            scheduler: status,
            serverTime: new Date().toLocaleString('th-TH'),
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
