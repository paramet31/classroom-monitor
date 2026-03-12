'use client';

import { useState, useEffect } from 'react';
import { Save, RotateCcw, GripVertical, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';

const STAFF = ['YIM', 'Narut', 'Payoot', 'Kowit', 'Jeeraphan'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS = ['RS', 'BKD'];
const STAFF_COLORS = {
    YIM: { bg: 'rgba(56,189,248,0.15)', border: '#ffffffff', text: '#38bdf8' },
    Narut: { bg: 'rgba(52,211,153,0.15)', border: '#ffffffff', text: '#34d399' },
    Payoot: { bg: 'rgba(251,146,60,0.15)', border: '#ffffffff', text: '#fb923c' },
    Kowit: { bg: 'rgba(168,85,247,0.15)', border: '#ffffffff', text: '#a855f7' },
    Jeeraphan: { bg: 'rgba(251,191,36,0.15)', border: '#ffffffff', text: '#fbbf24' },
};
const SLOT_COLORS = {
    RS: { dot: '#ffffffff', label: '#fcfcfcff' },
    BKD: { dot: '#ffffffff', label: '#ffffffff' },
};

function getMonthData(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=Sun
    const daysInMonth = lastDay.getDate();

    // Build weeks array — each week has 7 cells (some may be null for padding)
    const weeks = [];
    let currentWeek = [];

    // Calculate Monday-based offset: Mon=0, Tue=1, ..., Sun=6
    const mondayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Pad start
    for (let i = 0; i < mondayOffset; i++) {
        currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }

    // Pad end
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
    }

    return weeks;
}

function monthName(month) {
    return ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'][month];
}

export default function SchedulePage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth());
    const [schedule, setSchedule] = useState({});
    const [allData, setAllData] = useState({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dragItem, setDragItem] = useState(null);

    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const weeks = getMonthData(year, month);

    useEffect(() => {
        fetch('/api/team-schedule')
            .then(r => r.json())
            .then(data => {
                setAllData(data);
                if (data[monthKey]) setSchedule(data[monthKey]);
                else setSchedule({});
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (allData[monthKey]) setSchedule(allData[monthKey]);
        else setSchedule({});
    }, [year, month, allData]);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };
    const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); };

    const handleSave = async () => {
        setSaving(true);
        const newAll = { ...allData, [monthKey]: schedule };
        try {
            await fetch('/api/team-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAll)
            });
            setAllData(newAll);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { alert('Failed to save'); }
        setSaving(false);
    };

    const cellKey = (day, slotIdx) => `${day}-${SLOTS[slotIdx]}`;

    const getAssigned = (day, slotIdx) => {
        if (!day) return [];
        return schedule[cellKey(day, slotIdx)] || [];
    };

    const addStaff = (staffName, day, slotIdx) => {
        if (!day) return;
        const key = cellKey(day, slotIdx);
        const curr = schedule[key] || [];
        if (!curr.includes(staffName)) {
            setSchedule({ ...schedule, [key]: [...curr, staffName] });
        }
    };

    const removeStaff = (staffName, day, slotIdx) => {
        const key = cellKey(day, slotIdx);
        const curr = schedule[key] || [];
        setSchedule({ ...schedule, [key]: curr.filter(n => n !== staffName) });
    };

    const handleDragStart = (e, staffName) => {
        setDragItem(staffName);
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', staffName);
    };

    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };

    const handleDrop = (e, day, slotIdx) => {
        e.preventDefault();
        const name = e.dataTransfer.getData('text/plain');
        if (name && STAFF.includes(name)) addStaff(name, day, slotIdx);
        setDragItem(null);
    };

    const isToday = (day) => {
        if (!day) return false;
        return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
    };

    return (
        <div style={{ padding: '1.5rem 2rem', maxWidth: '1500px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#e6edf3', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserCheck size={28} style={{ color: '#3fb950' }} />
                        Team Schedule
                    </h1>
                    <p style={{ color: '#8b949e', margin: '4px 0 0', fontSize: '0.9rem' }}>Drag staff names to assign shifts · RS / BKD</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setSchedule({})} style={btnStyle('#30363d', '#8b949e')}>
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button onClick={handleSave} disabled={saving} style={btnStyle('#238636', '#fff')}>
                        <Save size={16} /> {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.2rem' }}>
                <button onClick={prevMonth} style={navBtn}><ChevronLeft size={18} /></button>
                <button onClick={goToday} style={{
                    ...navBtn, padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, width: 'auto',
                    color: (month === now.getMonth() && year === now.getFullYear()) ? '#3fb950' : '#e6edf3',
                    border: (month === now.getMonth() && year === now.getFullYear()) ? '1px solid #3fb950' : '1px solid #30363d'
                }}>Today</button>
                <button onClick={nextMonth} style={navBtn}><ChevronRight size={18} /></button>
                <span style={{ color: '#e6edf3', fontWeight: 700, fontSize: '1.15rem', marginLeft: '8px' }}>
                    {monthName(month)} {year}
                </span>
            </div>

            {/* Staff pool */}
            <div style={{
                background: 'rgba(22,27,34,0.6)', border: '1px solid #30363d',
                borderRadius: '12px', padding: '14px 16px', marginBottom: '1.2rem'
            }}>
                <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Team Members — Drag to assign
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {STAFF.map(name => {
                        const c = STAFF_COLORS[name];
                        return (
                            <div key={name} draggable onDragStart={(e) => handleDragStart(e, name)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '7px 14px', borderRadius: '8px',
                                    border: `1px solid ${c.border}`, background: c.bg, color: c.text,
                                    fontWeight: 600, fontSize: '0.85rem', cursor: 'grab', userSelect: 'none',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = `0 0 12px ${c.border}40`; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <GripVertical size={14} style={{ opacity: 0.5 }} />
                                {name}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Calendar grid */}
            <div style={{
                background: 'rgba(22,27,34,0.6)', border: '1px solid #30363d',
                borderRadius: '12px', overflow: 'hidden'
            }}>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #30363d' }}>
                    {DAYS.map((d, i) => (
                        <div key={d} style={{
                            padding: '10px', textAlign: 'center', fontWeight: 700,
                            fontSize: '0.8rem', color: i >= 5 ? '#f0883e' : '#8b949e',
                            background: 'rgba(13,17,23,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>{d}</div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid #21262d' : 'none' }}>
                        {week.map((day, di) => {
                            const today = isToday(day);
                            const isWeekend = di >= 5;
                            return (
                                <div key={di} style={{
                                    minHeight: '110px',
                                    borderRight: di < 6 ? '1px solid #21262d' : 'none',
                                    background: day === null ? 'rgba(13,17,23,0.3)'
                                        : today ? 'rgba(63,185,80,0.06)'
                                            : isWeekend ? 'rgba(240,136,62,0.03)'
                                                : 'transparent',
                                    padding: '6px',
                                    position: 'relative',
                                }}>
                                    {day !== null && (
                                        <>
                                            {/* Day number */}
                                            <div style={{
                                                display: 'flex', justifyContent: 'flex-end', marginBottom: '4px'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.8rem', fontWeight: 700,
                                                    color: today ? '#3fb950' : isWeekend ? '#f0883e' : '#8b949e',
                                                    background: today ? 'rgba(63,185,80,0.15)' : 'transparent',
                                                    padding: today ? '1px 7px' : '1px 4px',
                                                    borderRadius: '6px',
                                                }}>{day}</span>
                                            </div>

                                            {/* Slots */}
                                            {SLOTS.map((slot, si) => {
                                                const assigned = getAssigned(day, si);
                                                const sc = SLOT_COLORS[slot];
                                                return (
                                                    <div key={si}
                                                        onDragOver={handleDragOver}
                                                        onDrop={(e) => handleDrop(e, day, si)}
                                                        onDragEnter={e => { e.currentTarget.style.background = 'rgba(88,166,255,0.1)'; }}
                                                        onDragLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                                        style={{
                                                            marginBottom: si === 0 ? '3px' : 0,
                                                            padding: '3px 4px',
                                                            borderRadius: '6px',
                                                            minHeight: '28px',
                                                            transition: 'background 0.15s',
                                                        }}
                                                    >
                                                        {/* Slot label */}
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: '4px',
                                                            marginBottom: '2px'
                                                        }}>
                                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot }} />
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: sc.label, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{slot}</span>
                                                        </div>

                                                        {/* Assigned badges */}
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                            {assigned.map(name => {
                                                                const c = STAFF_COLORS[name] || { bg: '#333', border: '#555', text: '#ccc' };
                                                                return (
                                                                    <span key={name}
                                                                        onClick={() => removeStaff(name, day, si)}
                                                                        title={`Click to remove ${name}`}
                                                                        style={{
                                                                            fontSize: '0.65rem', fontWeight: 600,
                                                                            color: c.text, background: c.bg,
                                                                            border: `1px solid ${c.border}30`,
                                                                            padding: '1px 6px', borderRadius: '4px',
                                                                            cursor: 'pointer', transition: 'opacity 0.15s',
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                                                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                                                    >
                                                                        {name}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

const btnStyle = (bg, color) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
    background: bg, color, border: `1px solid ${bg}`,
    fontWeight: 600, fontSize: '0.85rem', fontFamily: 'inherit',
    transition: 'opacity 0.2s',
});

const navBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '34px', height: '34px', borderRadius: '8px',
    background: 'transparent', border: '1px solid #30363d', color: '#e6edf3',
    cursor: 'pointer', fontFamily: 'inherit',
};
