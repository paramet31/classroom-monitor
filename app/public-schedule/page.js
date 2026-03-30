'use client';

import { useState, useEffect } from 'react';
import styles from './PublicSchedule.module.css';
import { ROOMS } from '../../lib/roomConfig';
import { Calendar } from 'lucide-react';

export default function PublicSchedulePage() {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterYear, setFilterYear] = useState('2026'); // Updated default to 2026
    const [filterTerm, setFilterTerm] = useState('Term 1');

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/google-sheets-bookings', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setBookings(data);
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        } finally {
            setIsLoading(false);
        }
    };

    const approvedBookings = bookings.filter(b => b.status === 'approved' && String(b.year) === filterYear && String(b.term).trim() === filterTerm);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const generateSlots = (startH, endH) => {
        const slots = [];
        for (let h = startH; h < endH; h++) {
            const format = (hr) => `${hr.toString().padStart(2, '0')}:00`;
            slots.push(`${format(h)} - ${format(h + 1)}`);
        }
        return slots;
    };
    const allSlots = generateSlots(8, 21); // 08:00 to 21:00

    return (
        <div className={styles.pageContainer}>
            <header className={styles.pageHeader}>
                <div className={styles.headerContent}>
                    <div className={styles.iconWrap}>
                        <Calendar size={28} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Public Lab Schedule</h1>
                        <p className={styles.subtitle}>View assigned rooms and booked timeslots for SIIT Computer Labs.</p>
                    </div>
                </div>
            </header>

            <main className={styles.mainContent}>
                <div className={styles.controls}>
                    <div className={styles.filterGroup}>
                        <label>Academic Year</label>
                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={styles.select}>
                            <option value="2025">Year 2025</option>
                            <option value="2026">Year 2026</option>
                            <option value="2027">Year 2027</option>
                        </select>
                    </div>
                    <div className={styles.filterGroup}>
                        <label>Term</label>
                        <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className={styles.select}>
                            <option value="Term 1">Term 1</option>
                            <option value="Term 2">Term 2</option>
                            <option value="Term 3">Term 3</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className={styles.loading}>Loading schedule data...</div>
                ) : (
                    <div className={styles.scheduleList}>
                        {ROOMS.map(room => {
                            const roomBookings = approvedBookings.filter(b => b.room === room);
                            
                            return (
                                <div key={room} className={styles.roomSection}>
                                    <h2 className={styles.roomTitle}>{room}</h2>
                                    <div className={styles.tableWrapper}>
                                        <table className={styles.scheduleTable}>
                                            <thead>
                                                <tr>
                                                    <th className={styles.dayColHeader}>DAY / TIME</th>
                                                    {allSlots.map(slot => (
                                                        <th key={slot} className={styles.timeColHeader}>{slot}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {days.map(day => {
                                                    const dayBookings = roomBookings.filter(b => {
                                                        const bDay = b.requestedSlot ? b.requestedSlot.split(' ')[0] : (b.requestedDay || b.date);
                                                        return bDay === day;
                                                    });

                                                    return (
                                                        <tr key={day}>
                                                            <td className={styles.dayCol}>{day}</td>
                                                            {(() => {
                                                                let skipSlots = 0;
                                                                return allSlots.map(slotStr => {
                                                                    if (skipSlots > 0) {
                                                                        skipSlots--;
                                                                        return null;
                                                                    }

                                                                    const slotHour = parseInt(slotStr.split(':')[0], 10);
                                                                    
                                                                    const items = dayBookings.filter(b => {
                                                                        if (!b.requestedSlot) return false;
                                                                        const parts = b.requestedSlot.split(' ')[1]; 
                                                                        if (!parts) return false;
                                                                        const bStartHour = parseInt(parts.split(':')[0], 10);
                                                                        return bStartHour === slotHour;
                                                                    });

                                                                    if (items.length > 0) {
                                                                        let maxDuration = 1;
                                                                        items.forEach(b => {
                                                                            const timeParts = b.requestedSlot.split(' ').slice(1).join(' '); // "08:00 - 11:00"
                                                                            const times = timeParts.split(/[-–—]/);
                                                                            if (times.length === 2) {
                                                                                const start = parseInt(times[0].trim().split(':')[0], 10);
                                                                                let end = parseInt(times[1].trim().split(':')[0], 10);
                                                                                const endMin = parseInt(times[1].trim().split(':')[1], 10);
                                                                                if (endMin > 0) end += 1;
                                                                                
                                                                                const duration = end - start;
                                                                                if (duration > maxDuration) {
                                                                                    maxDuration = duration;
                                                                                }
                                                                            }
                                                                        });

                                                                        skipSlots = Math.max(0, maxDuration - 1);

                                                                        return (
                                                                            <td key={slotStr} colSpan={maxDuration} className={styles.slotActive} style={{ minWidth: `${maxDuration * 100}px` }}>
                                                                                {items.map(b => (
                                                                                    <div key={b.id} className={styles.bookingItem} title={`${b.lecturerName} - ${b.courseCode} (${b.section})`}>
                                                                                        <div className={styles.courseCode}>{b.courseCode} <span style={{fontSize: '11px', fontWeight: 'normal', opacity: 0.9}}>({b.section})</span></div>
                                                                                        <div className={styles.bookingTime}>{b.requestedSlot.split(' ').slice(1).join(' ')}</div>
                                                                                    </div>
                                                                                ))}
                                                                            </td>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <td key={slotStr} className={styles.slotEmpty}>
                                                                                <div className={styles.emptyBucket}></div>
                                                                            </td>
                                                                        );
                                                                    }
                                                                });
                                                            })()}
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
