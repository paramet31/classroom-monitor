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
        try {
            await writeRequests(requests);
        } catch (e) {
            console.warn('[Storage] Failed to write to JSON (likely Vercel environment):', e.message);
        }

        // ─── Send Email Notification (background) ───
        sendEmailNotification(newReq).catch(err => console.error('[Email Error]', err));
        
        // ─── Send Confirmation to User (background) ───
        sendUserConfirmation(newReq).catch(err => console.error('[Confirmation Email Error]', err));

        // ─── Forward to Google Apps Script / Sheets (background) ───
        forwardToGoogleSheets(newReq).catch(err => console.error('[Sheets Error]', err));

        return NextResponse.json(newReq, { status: 201 });
    } catch (error) {
        console.error('[POST /api/requests] Error:', error);
        return NextResponse.json({ error: 'Failed to submit request', details: error.message }, { status: 500 });
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

// ─── User Confirmation Email ───
async function sendUserConfirmation(req) {
    const nodemailer = (await import('nodemailer')).default;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) return;

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    const purposeStr = (req.purpose || []).join(', ') || '-';
    const itemsHtml = (req.items || []).map((item, i) => `
        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0;">
            <div style="font-weight: bold; color: #1e293b; margin-bottom: 4px;">Item ${i + 1}: ${item.material} (Qty: ${item.quantity})</div>
            <div style="font-size: 13px; color: #64748b;">
                <strong>Setup:</strong> ${item.setupDatetime || '-'}<br/>
                <strong>Usage:</strong> ${item.usageDatetime || '-'}<br/>
                <strong>Location:</strong> ${item.location || '-'}
            </div>
        </div>
    `).join('');

    const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center;">
            <div style="color: #38bdf8; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Submission Received</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Request ID: ${req.id}</h1>
        </div>
        
        <div style="padding: 30px;">
            <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                เรียน คุณ <strong>${req.email}</strong>,<br/><br/>
                เราได้รับคำร้องขอรับบริการ AV ของคุณเรียบร้อยแล้ว ขณะนี้คำร้องของคุณอยู่ในขั้นตอน **รอการตรวจสอบ (Pending)** โดยเจ้าหน้าที่จะดำเนินการตรวจสอบและติดต่อกลับโดยเร็วที่สุด
            </p>

            <div style="margin: 25px 0; padding: 20px; background: #f1f5f9; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">ข้อมูลสรุปการขอรับบริการ</h3>
                <table style="width: 100%; font-size: 14px; color: #475569;">
                    <tr>
                        <td style="padding: 5px 0; width: 100px;"><strong>หัวข้อ:</strong></td>
                        <td style="padding: 5px 0;">${req.subject}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0;"><strong>วัตถุประสงค์:</strong></td>
                        <td style="padding: 5px 0;">${purposeStr}</td>
                    </tr>
                </table>
            </div>

            <h3 style="color: #1e293b; font-size: 16px;">รายการอุปกรณ์ / สถานที่</h3>
            ${itemsHtml}

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #94a3b8; font-size: 13px;">
                    นี่คือการตอบกลับอัตโนมัติ กรุณาอย่าตอบกลับอีเมลฉบับนี้<br/>
                    SIIT Computer & AV Center
                </p>
            </div>
        </div>
    </div>
    `;

    await transporter.sendMail({
        from: `"SIIT AV Center" <${user}>`,
        to: req.email,
        subject: `เราได้รับคำร้องของคุณแล้ว [${req.id}] — ${req.subject}`,
        html: htmlContent,
    });

    console.log(`[Confirmation Email] Success: Sent acknowledgment to ${req.email}`);
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
