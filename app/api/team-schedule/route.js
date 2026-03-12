import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'team-schedule.json');

function readSchedule() {
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function writeSchedule(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET() {
    try {
        const data = readSchedule();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read schedule' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        writeSchedule(body);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 });
    }
}
