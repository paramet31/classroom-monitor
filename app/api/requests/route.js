import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const FILE_PATH = path.join(process.cwd(), 'data', 'requests.json');

async function readRequests() {
    try {
        const data = await fs.readFile(FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch { return []; }
}

async function writeRequests(data) {
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

function generateId() {
    const num = Date.now().toString(36).toUpperCase().slice(-5);
    return `REQ-${num}`;
}

// GET — list all requests
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let requests = await readRequests();

    if (status && status !== 'all') {
        requests = requests.filter(r => r.status === status);
    }

    requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return NextResponse.json(requests);
}

// POST — submit new request (public)
export async function POST(request) {
    try {
        const body = await request.json();
        const { email, to, subject, purpose, detail, items } = body;

        if (!email || !subject) {
            return NextResponse.json({ error: 'Email and subject are required' }, { status: 400 });
        }

        const requests = await readRequests();

        const newReq = {
            id: generateId(),
            email,
            to: to || '',
            subject,
            purpose: purpose || [],
            detail: detail || '',
            items: (items || []).filter(i => i.material?.trim()),
            status: 'pending',
            assignedTo: null,
            adminNotes: [],
            createdAt: new Date().toISOString()
        };

        requests.unshift(newReq);
        await writeRequests(requests);

        // ─── Send Email Notification (background) ───
        sendEmailNotification(newReq).catch(err => console.error('[Email Error]', err));

        // ─── Forward to Google Apps Script / Sheets (background) ───
        forwardToGoogleSheets(newReq).catch(err => console.error('[Sheets Error]', err));

        return NextResponse.json(newReq, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }
}

// ─── Email Notification ───
async function sendEmailNotification(req) {
    const nodemailer = (await import('nodemailer')).default;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) { console.warn('[Email] No credentials'); return; }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    const TEAM = [
        'paramet@siit.tu.ac.th',
        'kowit@siit.tu.ac.th',
        'phungchok@siit.tu.ac.th',
        'narut@siit.tu.ac.th',
        'jeraphan@siit.tu.ac.th',
    ];

    const purposeStr = (req.purpose || []).join(', ') || '-';
    const items = req.items || [];

    let body = `A new AV request form has been submitted.\n\n`;
    body += `From: ${req.email}\n`;
    body += `To: ${req.to}\n`;
    body += `Subject: ${req.subject}\n`;
    body += `Purpose: ${purposeStr}\n`;
    body += `Detail: ${req.detail || '-'}\n\n`;

    items.forEach((item, i) => {
        body += `Material ${i + 1}: ${item.material || '-'}\n`;
        body += `Quantity ${i + 1}: ${item.quantity || '-'}\n`;
        body += `Setup Date/Time ${i + 1}: ${item.setupDatetime || '-'}\n`;
        body += `Usage Date/Time ${i + 1}: ${item.usageDatetime || '-'}\n`;
        body += `Usage Location ${i + 1}: ${item.location || '-'}\n\n`;
    });

    await transporter.sendMail({
        from: user,
        to: TEAM.join(', '),
        subject: `New AV Request Form Submission — ${req.subject}`,
        text: body,
    });

    console.log('[Email] Sent to', TEAM.length, 'recipients');
}

// ─── Google Sheets via Apps Script ───
async function forwardToGoogleSheets(req) {
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!url) { console.warn('[Sheets] No GOOGLE_APPS_SCRIPT_URL set'); return; }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });

    const result = await res.json();
    console.log('[Sheets]', result.success ? 'Written to Sheets' : 'Failed', result);
}

// PATCH — update request status / assign / add notes (admin)
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, status, assignedTo, note, noteBy } = body;

        if (!id) return NextResponse.json({ error: 'Request ID required' }, { status: 400 });

        const requests = await readRequests();
        const idx = requests.findIndex(r => r.id === id);
        if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        if (status) requests[idx].status = status;
        if (assignedTo) requests[idx].assignedTo = assignedTo;
        if (note && noteBy) {
            requests[idx].adminNotes.push({ note, by: noteBy, at: new Date().toISOString() });
        }

        await writeRequests(requests);
        return NextResponse.json(requests[idx]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}

// DELETE — delete request
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        let requests = await readRequests();
        const before = requests.length;
        requests = requests.filter(r => r.id !== id);
        if (requests.length === before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await writeRequests(requests);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
