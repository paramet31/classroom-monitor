import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// GET /api/auth/me — return current logged-in user info
export async function GET() {
    try {
        const cookieStore = await cookies();
        const session = cookieStore.get('auth_session');

        if (!session) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const data = JSON.parse(Buffer.from(session.value, 'base64').toString('utf-8'));

        return NextResponse.json({
            user: {
                id: data.id,
                name: data.name,
                email: data.email,
                role: data.role
            }
        });
    } catch (error) {
        return NextResponse.json({ user: null }, { status: 401 });
    }
}
