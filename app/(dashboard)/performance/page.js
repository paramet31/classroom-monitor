'use client';

import { useState, useEffect } from 'react';
import { BarChart3, User, Clock, CheckCircle, AlertCircle, TrendingUp, RefreshCw } from 'lucide-react';

export default function PerformancePage() {
    const [cases, setCases] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/cases').then(r => r.json()),
            fetch('/api/users').then(r => r.json()).catch(() => [])
        ]).then(([casesData, usersData]) => {
            setCases(Array.isArray(casesData) ? casesData : []);
            setUsers(Array.isArray(usersData) ? usersData : []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: '2rem', color: '#8b949e' }}>Loading performance data...</div>;

    // Get all tech users
    const techUsers = users.filter(u => u.role === 'tech');
    const allAssignees = [...new Set(cases.map(c => c.assignee).filter(Boolean))];

    // Calculate stats per tech
    const techStats = (techUsers.length > 0 ? techUsers : allAssignees.map(e => ({ email: e, name: e.split('@')[0] }))).map(tech => {
        const email = tech.email;
        const myCases = cases.filter(c => c.assignee === email);
        const resolved = myCases.filter(c => c.status === 'resolved' || c.status === 'closed');
        const open = myCases.filter(c => c.status === 'open' || c.status === 'in-progress');

        // Average resolution time (for resolved cases)
        let avgResolutionHours = 0;
        if (resolved.length > 0) {
            const totalMs = resolved.reduce((sum, c) => {
                const created = new Date(c.createdAt);
                const resolvedAt = c.resolvedAt ? new Date(c.resolvedAt) : new Date();
                return sum + (resolvedAt - created);
            }, 0);
            avgResolutionHours = Math.round(totalMs / resolved.length / 3600000 * 10) / 10;
        }

        // Total progress notes
        const totalNotes = myCases.reduce((sum, c) => sum + (c.progress?.length || 0), 0);

        // This week's cases
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const thisWeek = myCases.filter(c => new Date(c.createdAt) >= weekStart);

        return {
            name: tech.name,
            email,
            total: myCases.length,
            resolved: resolved.length,
            open: open.length,
            avgResolutionHours,
            totalNotes,
            thisWeek: thisWeek.length,
            resolveRate: myCases.length > 0 ? Math.round(resolved.length / myCases.length * 100) : 0,
        };
    });

    // Overall stats
    const totalCases = cases.length;
    const totalResolved = cases.filter(c => c.status === 'resolved' || c.status === 'closed').length;
    const totalOpen = cases.filter(c => c.status === 'open' || c.status === 'in-progress').length;

    return (
        <div style={{ maxWidth: 1000 }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={24} style={{ color: '#58a6ff' }} /> Performance Dashboard
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: 4 }}>
                    Team performance overview — Admin only
                </p>
            </div>

            {/* Overall Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
                <OverviewCard icon={<AlertCircle size={16} />} label="Total Cases" value={totalCases} color="#c9d1d9" />
                <OverviewCard icon={<Clock size={16} />} label="Open" value={totalOpen} color="#e3b341" />
                <OverviewCard icon={<CheckCircle size={16} />} label="Resolved" value={totalResolved} color="#3fb950" />
                <OverviewCard icon={<TrendingUp size={16} />} label="Resolve Rate" value={totalCases > 0 ? Math.round(totalResolved / totalCases * 100) + '%' : '—'} color="#58a6ff" />
            </div>

            {/* Per-Tech Performance */}
            <div style={sty.section}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #30363d' }}>
                    <User size={18} style={{ color: '#58a6ff' }} />
                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: 0 }}>Individual Performance</h2>
                    <span style={sty.badge}>{techStats.length} members</span>
                </div>

                {techStats.length === 0 ? (
                    <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>No tech members found. Cases will appear once team members create them.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {techStats.map(tech => (
                            <div key={tech.email} style={{
                                background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
                                padding: '1rem 1.25rem',
                            }}>
                                {/* Name row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', background: 'rgba(88,166,255,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.75rem', fontWeight: 700, color: '#58a6ff'
                                        }}>
                                            {tech.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e6edf3' }}>{tech.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#8b949e' }}>{tech.email}</div>
                                        </div>
                                    </div>
                                    {/* Resolve rate badge */}
                                    <div style={{
                                        fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace',
                                        color: tech.resolveRate >= 70 ? '#3fb950' : tech.resolveRate >= 40 ? '#e3b341' : '#ff7b72',
                                    }}>
                                        {tech.resolveRate}% resolved
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                                    <MiniStat label="Total" value={tech.total} />
                                    <MiniStat label="Open" value={tech.open} color="#e3b341" />
                                    <MiniStat label="Resolved" value={tech.resolved} color="#3fb950" />
                                    <MiniStat label="This Week" value={tech.thisWeek} color="#58a6ff" />
                                    <MiniStat label="Avg. Time" value={tech.avgResolutionHours > 0 ? `${tech.avgResolutionHours}h` : '—'} color="#8b949e" />
                                </div>

                                {/* Progress bar */}
                                <div style={{ marginTop: '0.6rem' }}>
                                    <div style={{
                                        height: 4, borderRadius: 2, background: '#30363d', overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%', borderRadius: 2,
                                            width: `${tech.resolveRate}%`,
                                            background: tech.resolveRate >= 70 ? '#238636' : tech.resolveRate >= 40 ? '#9e6a03' : '#da3633',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function OverviewCard({ icon, label, value, color }) {
    return (
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', color }}>
                {icon}
                <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8b949e' }}>{label}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color, lineHeight: 1.2 }}>{value}</div>
        </div>
    );
}

function MiniStat({ label, value, color = '#c9d1d9' }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace', color }}>{value}</div>
            <div style={{ fontSize: '0.6rem', color: '#8b949e', textTransform: 'uppercase' }}>{label}</div>
        </div>
    );
}

const sty = {
    section: {
        background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
        padding: '1.25rem', marginBottom: '1rem',
    },
    badge: {
        fontSize: '0.65rem', color: '#8b949e', background: 'rgba(139,148,158,0.1)',
        padding: '0.15rem 0.45rem', borderRadius: 10, border: '1px solid rgba(139,148,158,0.2)',
        marginLeft: 'auto',
    },
};
