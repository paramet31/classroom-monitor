import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        // Basic validation
        if (!email || !password) {
            return NextResponse.json(
                { message: 'กรุณากรอก Email และ Password' },
                { status: 400 }
            );
        }

        // Read user accounts from JSON database
        const usersFilePath = path.join(process.cwd(), 'data', 'users.json');
        const usersData = await fs.readFile(usersFilePath, 'utf-8');
        const users = JSON.parse(usersData);

        // Find matching user (case-insensitive email)
        const user = users.find(
            (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (user) {
            // Create a session payload (store user info in cookie value)
            const sessionData = JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            });

            // Encode to base64 for safe cookie transport
            const sessionToken = Buffer.from(sessionData).toString('base64');

            const response = NextResponse.json(
                { message: 'เข้าสู่ระบบสำเร็จ', user: { name: user.name, email: user.email, role: user.role } },
                { status: 200 }
            );

            // Cookie settings for LAN usage (HTTP, not HTTPS)
            response.cookies.set({
                name: 'auth_session',
                value: sessionToken,
                httpOnly: true,
                secure: false, // LAN ใช้ HTTP ไม่มี HTTPS — ถ้าตั้ง true จะ login ไม่ได้
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                path: '/',
            });

            return response;
        }

        return NextResponse.json(
            { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' },
            { status: 401 }
        );

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { message: 'เกิดข้อผิดพลาดภายในระบบ' },
            { status: 500 }
        );
    }
}
