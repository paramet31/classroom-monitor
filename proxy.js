import { NextResponse } from 'next/server';

export function proxy(request) {
    const { pathname } = request.nextUrl;
    const sessionCookie = request.cookies.get('auth_session');

    // Paths that don't require authentication
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth') || pathname.startsWith('/request') || pathname.startsWith('/api/requests');
    const isPublicRoute = pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico') || pathname.startsWith('/public') || pathname.startsWith('/api/lab-booking');

    if (isPublicRoute) {
        return NextResponse.next();
    }

    // If user is trying to access a protected route without a session
    if (!sessionCookie && !isAuthRoute) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // If user is logged in but tries to access login page, redirect to dashboard
    if (sessionCookie && pathname === '/login') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Role-based access control
    if (sessionCookie) {
        try {
            const sessionData = JSON.parse(
                Buffer.from(sessionCookie.value, 'base64').toString('utf-8')
            );
            const role = sessionData.role;

            // Admin-only routes
            const adminOnlyRoutes = ['/settings', '/performance', '/cases/timeline'];
            const isAdminRoute = adminOnlyRoutes.some(r => pathname.startsWith(r));

            if (isAdminRoute && role !== 'admin') {
                // Redirect tech users to dashboard
                const dashboardUrl = new URL('/', request.url);
                dashboardUrl.searchParams.set('restricted', '1');
                return NextResponse.redirect(dashboardUrl);
            }
        } catch (e) {
            // If session is corrupted, clear it and redirect to login
            const loginUrl = new URL('/login', request.url);
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('auth_session');
            return response;
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
