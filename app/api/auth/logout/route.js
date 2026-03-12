import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json(
        { message: 'Logged out successfully' },
        { status: 200 }
    );

    // Clear the auth session cookie securely
    response.cookies.set({
        name: 'auth_session',
        value: '',
        httpOnly: true,
        expires: new Date(0), // Expire immediately
        path: '/',
    });

    return response;
}
