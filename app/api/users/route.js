import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// GET /api/users — return user list (without passwords)
export async function GET() {
    try {
        const usersPath = path.join(process.cwd(), 'data', 'users.json');
        const data = await fs.readFile(usersPath, 'utf-8');
        const users = JSON.parse(data);

        // Strip passwords
        const safeUsers = users.map(({ password, ...rest }) => rest);

        return NextResponse.json(safeUsers);
    } catch (error) {
        return NextResponse.json([], { status: 500 });
    }
}
