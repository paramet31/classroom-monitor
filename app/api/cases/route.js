import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CASES_PATH = path.join(process.cwd(), 'data', 'cases.json');

async function readCases() {
    try {
        const data = await fs.readFile(CASES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeCases(cases) {
    await fs.writeFile(CASES_PATH, JSON.stringify(cases, null, 2));
}

function generateId() {
    const num = Date.now().toString(36).toUpperCase().slice(-4);
    return `CASE-${num}`;
}

// GET /api/cases — list all cases, optional ?status=open&assignee=x
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignee = searchParams.get('assignee');

    let cases = await readCases();

    if (status && status !== 'all') {
        cases = cases.filter(c => c.status === status);
    }
    if (assignee) {
        cases = cases.filter(c => c.assignee === assignee);
    }

    // Sort by createdAt descending (newest first)
    cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json(cases);
}

// POST /api/cases — create new case
export async function POST(request) {
    try {
        const body = await request.json();
        const { title, description, assignee, priority, createdBy } = body;

        if (!title || !createdBy) {
            return NextResponse.json({ error: 'Title and createdBy are required' }, { status: 400 });
        }

        const cases = await readCases();

        const newCase = {
            id: generateId(),
            title,
            description: description || '',
            createdBy,
            assignee: assignee || createdBy,
            status: 'open',
            priority: priority || 'medium',
            createdAt: new Date().toISOString(),
            progress: []
        };

        cases.unshift(newCase);
        await writeCases(cases);

        return NextResponse.json(newCase, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
    }
}

// PATCH /api/cases — update case (add progress, change status)
export async function PATCH(request) {
    try {
        const body = await request.json();
        const { id, status, note, by, assignee } = body;

        if (!id) {
            return NextResponse.json({ error: 'Case ID is required' }, { status: 400 });
        }

        const cases = await readCases();
        const caseIndex = cases.findIndex(c => c.id === id);

        if (caseIndex === -1) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        }

        // Add progress note
        if (note && by) {
            cases[caseIndex].progress.push({
                note,
                by,
                at: new Date().toISOString()
            });
        }

        // Update status
        if (status) {
            cases[caseIndex].status = status;
            if (status === 'resolved' || status === 'closed') {
                cases[caseIndex].resolvedAt = new Date().toISOString();
            }
        }

        // Update assignee
        if (assignee) {
            cases[caseIndex].assignee = assignee;
        }

        await writeCases(cases);

        return NextResponse.json(cases[caseIndex]);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
    }
}

// DELETE /api/cases — delete case
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Case ID is required' }, { status: 400 });
        }

        let cases = await readCases();
        const before = cases.length;
        cases = cases.filter(c => c.id !== id);

        if (cases.length === before) {
            return NextResponse.json({ error: 'Case not found' }, { status: 404 });
        }

        await writeCases(cases);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
    }
}
