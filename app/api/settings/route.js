import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

function readSettings() {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    } catch (e) {
        return null;
    }
}

function writeSettings(data) {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2));
}

// GET — Read settings
export async function GET() {
    const settings = readSettings();
    if (!settings) {
        return NextResponse.json({ error: 'Settings file not found' }, { status: 500 });
    }
    return NextResponse.json(settings);
}

// PUT — Update settings (partial or full)
export async function PUT(request) {
    try {
        const body = await request.json();
        const current = readSettings() || {};
        const updated = { ...current, ...body };
        writeSettings(updated);

        // Dynamically import to avoid circular dependencies and restart scheduler
        try {
            const { stopScheduler, startScheduler } = await import('../../../lib/scheduler');
            stopScheduler();
            startScheduler();
        } catch (schedulerErr) {
            console.error('Failed to restart scheduler on settings update:', schedulerErr);
        }

        return NextResponse.json({ success: true, settings: updated });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
