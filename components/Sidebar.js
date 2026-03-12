'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, FileText, Settings, Monitor, HelpCircle, Sparkles, LogOut, ClipboardList, BarChart3, GanttChart, Inbox, Calendar, Activity, CalendarDays, BookOpen, UserCog } from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState(null);

    // Fetch user from session API (cookie is httpOnly, can't read from JS)
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(data => { if (data.user) setUser(data.user); })
            .catch(() => { });
    }, []);

    const isAdmin = user?.role === 'admin';

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    // Build nav items based on role
    const MAIN_ITEMS = [
        { href: '/', label: 'Dashboard-Encoder', icon: LayoutDashboard },
        { href: '/reports', label: 'Reports-Encoder', icon: FileText },
        { href: '/analytics', label: 'Analytics', icon: Activity },
        { href: '/cases', label: 'Case', icon: ClipboardList }
    ];

    if (isAdmin) {
        MAIN_ITEMS.push({ href: '/cases/timeline', label: 'Timeline', icon: GanttChart });
    }

    MAIN_ITEMS.push({ href: '/requests', label: 'Request', icon: Inbox });
    MAIN_ITEMS.push({ href: '/requests/calendar', label: 'Request Calendar', icon: Calendar });
    MAIN_ITEMS.push({ href: '/schedule', label: 'Team Schedule', icon: CalendarDays });

    const LAB_ITEMS = [
        { href: '/lab-booking', label: 'Lab Booking', icon: BookOpen }
    ];

    if (isAdmin) {
        MAIN_ITEMS.push({ href: '/performance', label: 'Performance', icon: BarChart3 });
        LAB_ITEMS.push({ href: '/lab-admin', label: 'Manage Labs', icon: UserCog });
        MAIN_ITEMS.push({ href: '/settings', label: 'Settings', icon: Settings });
    }

    // User initials for avatar
    const initials = user?.name
        ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : 'CM';

    return (
        <aside className="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-logo">
                    <Monitor size={20} />
                </div>
                <span className="sidebar-brand-text">Classroom Monitor</span>
            </div>

            {/* Main Nav */}
            <nav className="sidebar-nav">
                <div className="sidebar-section-label">MAIN</div>
                {MAIN_ITEMS.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}

                <div className="sidebar-section-label" style={{ marginTop: '1.5rem' }}>LABS</div>
                {LAB_ITEMS.map(item => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href === '/lab-admin' && pathname.startsWith('/lab-admin'));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <Link href="#" className="sidebar-link">
                    <HelpCircle size={18} />
                    <span>Support</span>
                </Link>
                <Link href="#" className="sidebar-link">
                    <Sparkles size={18} />
                    <span>Changelog</span>
                </Link>
                <button
                    onClick={handleLogout}
                    className="sidebar-link"
                    style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', fontFamily: 'inherit' }}
                >
                    <LogOut size={18} />
                    <span>Sign Out</span>
                </button>

                <div className="sidebar-user">
                    <div className="sidebar-user-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name || 'Loading...'}</div>
                        <div className="sidebar-user-email">{user?.email || ''}</div>
                    </div>
                    {isAdmin && (
                        <span style={{
                            fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase',
                            color: '#f0883e', background: 'rgba(240,136,62,0.1)',
                            padding: '0.1rem 0.35rem', borderRadius: '4px',
                            border: '1px solid rgba(240,136,62,0.25)',
                            marginLeft: 'auto'
                        }}>
                            Admin
                        </span>
                    )}
                </div>
            </div>
        </aside>
    );
}
