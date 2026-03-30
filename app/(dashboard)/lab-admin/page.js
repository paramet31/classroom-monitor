'use client';

import { useState, useEffect } from 'react';
import styles from './LabBooking.module.css';
import { List, Calendar as CalendarIcon, Save, Trash2, Edit, XCircle, Search, Users, BookOpen, Upload, RefreshCw } from 'lucide-react';
import { ROOMS, isRoomOccupied, parseRequestedSlot, autoAssignRoom, findConflictingBookings } from '../../../lib/roomConfig';

export default function LabAdminPage() {
    const [activeTab, setActiveTab] = useState('manage'); // 'manage', 'schedule'
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // Edit State
    const [editingBooking, setEditingBooking] = useState(null);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [conflictInfo, setConflictInfo] = useState(null); // { booking, conflicts: [] }

    // Filters for Schedule/Manage
    const [filterYear, setFilterYear] = useState('2025');
    const [filterTerm, setFilterTerm] = useState('Term 1');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchBookings();

        // Auto-refresh data every 15 seconds
        const intervalId = setInterval(() => {
            fetchBookings(false);
        }, 15000);

        return () => clearInterval(intervalId);
    }, []);

    const fetchBookings = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        try {
            const res = await fetch('/api/lab-booking');
            if (res.ok) {
                const data = await res.json();
                setBookings(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const updateBookingStatus = async (id, newStatus) => {
        if (newStatus === 'approved') {
            const b = bookings.find(x => x.id === id);
            if (!b.room) {
                setConflictInfo({ type: 'no-room', booking: b, conflicts: [] });
                return;
            }
            const bSlot = parseRequestedSlot(b.requestedSlot);
            if (bSlot) {
                const conflicts = findConflictingBookings(b.room, bSlot.day, bSlot.period, b.year, b.term, bookings.filter(x => x.id !== id));
                if (conflicts.length > 0) {
                    setConflictInfo({ type: 'conflict', booking: b, conflicts });
                    return;
                }
            }
        }

        try {
            const res = await fetch('/api/lab-booking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });

            if (res.ok) {
                fetchBookings();
            }
        } catch (error) {
            console.error('Failed to update status', error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this booking?')) return;

        try {
            const res = await fetch(`/api/lab-booking?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                fetchBookings();
            }
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    const handleEditSave = async (e) => {
        e.preventDefault();

        if (editingBooking.status === 'approved' && editingBooking.room) {
            const bSlot = parseRequestedSlot(editingBooking.requestedSlot);
            if (bSlot) {
                const conflicts = findConflictingBookings(editingBooking.room, bSlot.day, bSlot.period, editingBooking.year, editingBooking.term, bookings.filter(x => x.id !== editingBooking.id));
                if (conflicts.length > 0) {
                    setConflictInfo({ type: 'conflict', booking: editingBooking, conflicts });
                    return;
                }
            }
        }

        try {
            const res = await fetch('/api/lab-booking', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingBooking)
            });

            if (res.ok) {
                setEditingBooking(null);
                fetchBookings();
            }
        } catch (error) {
            console.error('Failed to update', error);
        }
    };

    // Import booking from standalone JSON file
    const handleImportBooking = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const imported = JSON.parse(text);

            // Auto-assign room based on imported data
            const slotForCheck = imported.requestedSlot || `${imported.requestedDay} ${imported.startTime} - ${imported.endTime}`;
            const result = autoAssignRoom(
                imported.campus,
                imported.totalStudents,
                slotForCheck,
                imported.year,
                imported.term,
                bookings
            );

            const bookingData = {
                ...imported,
                requestedSlot: slotForCheck,
                room: result.room || '',
                initialRoom: result.room || '',
                status: 'pending'
            };

            const res = await fetch('/api/lab-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (res.ok) {
                alert(`นำเข้าคำร้องจาก ${imported.lecturerName} (${imported.courseCode}) สำเร็จแล้ว!${result.room ? `\nRoom: ${result.room}` : '\n⚠️ ไม่สามารถจัดห้องได้อัตโนมัติ'}`);
                fetchBookings();
            } else {
                alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
            }
        } catch (err) {
            console.error('Import error', err);
            alert('ไฟล์ไม่ถูกต้อง กรุณาตรวจสอบไฟล์ .json');
        }
        // Reset file input
        e.target.value = '';
    };

    // Auto Sync from Google Sheets
    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.count > 0) {
                    alert(`ซิงค์สำเร็จ! ได้คำร้องขอมาใหม่ ${data.count} รายการ`);
                    fetchBookings();
                } else {
                    alert('ไม่มีคำร้องจอใหม่ในขณะนี้');
                }
            } else {
                alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูลจาก Google Sheets');
            }
        } catch (error) {
            console.error('Sync failed', error);
            alert('การดึงข้อมูลล้มเหลว โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        } finally {
            setIsSyncing(false);
        }
    };

    // Derived Data for Views
    const filteredBookings = bookings.filter(b => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (b.lecturerName?.toLowerCase().includes(q) ||
                b.courseCode?.toLowerCase().includes(q) ||
                b.program?.toLowerCase().includes(q) ||
                b.section?.toLowerCase().includes(q) ||
                b.room?.toLowerCase().includes(q));
        }
        return true;
    });

    const renderManageTab = () => {
        if (editingBooking) {
            return (
                <div className={styles.card}>
                    <div className={styles.header}>
                        <div>
                            <h3 className={styles.title} style={{ fontSize: '1.25rem' }}>Edit Booking</h3>
                            <p className={styles.subtitle}>Editing mapping for {editingBooking.courseCode}</p>
                        </div>
                        <button onClick={() => setEditingBooking(null)} className={styles.actionBtn}>
                            <XCircle size={24} />
                        </button>
                    </div>

                    <form onSubmit={handleEditSave}>
                        <div className={styles.formGrid}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Assigned Room</label>
                                <select
                                    value={editingBooking.room || ''}
                                    onChange={e => setEditingBooking({ ...editingBooking, room: e.target.value })}
                                    className={styles.select}
                                >
                                    {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                                    <option value="">(Not Assigned)</option>
                                </select>
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Status</label>
                                <select
                                    value={editingBooking.status}
                                    onChange={e => setEditingBooking({ ...editingBooking, status: e.target.value })}
                                    className={styles.select}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button type="submit" className={styles.submitBtn} style={{ width: 'auto' }}>Save Changes</button>
                            <button type="button" onClick={() => setEditingBooking(null)} className={styles.submitBtn} style={{ background: 'var(--card-border)', width: 'auto' }}>Cancel</button>
                        </div>
                    </form>
                </div>
            )
        }

        return (
            <div className={styles.card}>
                <div className={styles.header} style={{ alignItems: 'center' }}>
                    <div>
                        <h3 className={styles.title} style={{ fontSize: '1.25rem' }}>All Requests</h3>
                        <p className={styles.subtitle}>{filteredBookings.length} total requests</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div className={styles.formGroup} style={{ marginBottom: 0, width: '250px', flexDirection: 'row', alignItems: 'center' }}>
                            <Search size={18} style={{ color: 'var(--text-muted)', position: 'absolute', marginLeft: '10px' }} />
                            <input
                                type="text"
                                className={styles.input}
                                style={{ paddingLeft: '2.5rem' }}
                                placeholder="Search course, lecturer, room..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <input type="file" accept=".json" id="importFile" style={{ display: 'none' }} onChange={handleImportBooking} />
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className={styles.actionBtn}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600, fontSize: '0.8rem', cursor: isSyncing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                        >
                            <RefreshCw size={16} style={{ animation: isSyncing ? 'spin 1.5s linear infinite' : 'none' }} />
                            {isSyncing ? 'Syncing...' : 'Auto Sync'}
                        </button>
                        <button
                            onClick={() => document.getElementById('importFile').click()}
                            className={styles.actionBtn}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            <Upload size={16} /> Import Booking
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Lecturer</th>
                                <th>Course Name</th>
                                <th>Program</th>
                                <th>Section</th>
                                <th>Requested Slot</th>
                                <th>Assigned Room</th>
                                <th>Students</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No requests found.</td></tr>
                            ) : filteredBookings.map(b => (
                                <tr key={b.id}>
                                    <td>
                                        <div className={styles.flexRow}>
                                            <div className={styles.avatar}>{b.lecturerName?.charAt(0) || 'U'}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{b.lecturerName}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{b.courseCode || '-'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-bright)' }}>{b.program || '-'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-bright)' }}>{b.section || '-'}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-bright)' }}>{b.requestedSlot}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{b.room || <span style={{ color: 'var(--danger)' }}>Not Assigned</span>}</div>
                                        {b.campus && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.campus.split(' ')[0]}</div>}
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{b.totalStudents}</div>
                                    </td>
                                    <td>
                                        <select
                                            value={b.status}
                                            onChange={(e) => updateBookingStatus(b.id, e.target.value)}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid var(--card-border)',
                                                borderRadius: '4px',
                                                padding: '0.25rem 0.5rem',
                                                color: b.status === 'approved' ? 'var(--primary)' : (b.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'),
                                                fontWeight: 600,
                                                fontSize: '0.75rem',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="pending" style={{ color: '#000' }}>Pending</option>
                                            <option value="approved" style={{ color: '#000' }}>Approved</option>
                                            <option value="rejected" style={{ color: '#000' }}>Rejected</option>
                                        </select>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button onClick={() => setEditingBooking(b)} className={styles.actionBtn} title="Edit">
                                            <Edit size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(b.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderScheduleTab = () => {
        const approvedBookings = bookings.filter(b => b.status === 'approved' && b.year === filterYear && b.term === filterTerm);
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        return (
            <div>
                <div className={styles.filters}>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={styles.filterSelect}>
                        {Array.from({length: 11}, (_, i) => 2025 + i).map(y => (
                            <option key={y} value={String(y)}>Year {y}</option>
                        ))}
                    </select>
                    <select value={filterTerm} onChange={e => setFilterTerm(e.target.value)} className={styles.filterSelect}>
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                    </select>
                </div>

                {ROOMS.map(room => {
                    const roomBookings = approvedBookings.filter(b => b.room === room);

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
                        <div key={room} className={styles.scheduleGrid}>
                            <div className={styles.roomTitle}>{room}</div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className={styles.scheduleTable} style={{ minWidth: '100%', tableLayout: 'fixed', fontSize: '0.75rem' }}>
                                    <thead>
                                        <tr>
                                            <th className={styles.dayCol} style={{ position: 'sticky', left: 0, zIndex: 2, background: 'var(--card-bg)', width: '100px' }}>DAY / TIME</th>
                                            {allSlots.map(slot => (
                                                <th key={slot} style={{ padding: '8px 4px', fontSize: '0.75rem', fontWeight: '600', minWidth: '100px', whiteSpace: 'nowrap' }}>{slot}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {days.map(day => {
                                            const dayBookings = roomBookings.filter(b => {
                                                const bDay = b.requestedSlot ? b.requestedSlot.split(' ')[0] : b.date;
                                                return bDay === day;
                                            });

                                            return (
                                                <tr key={day}>
                                                    <td className={styles.dayCol} style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--card-bg)' }}>{day}</td>
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
                                                                const parts = b.requestedSlot.split(' ')[1]; // Get "08:30"
                                                                if (!parts) return false;
                                                                const bStartHour = parseInt(parts.split(':')[0], 10);
                                                                return bStartHour === slotHour;
                                                            });

                                                            if (items.length > 0) {
                                                                // Find max duration if multiple items start at same hour
                                                                let maxDuration = 1;
                                                                items.forEach(b => {
                                                                    const timeParts = b.requestedSlot.split(' ').slice(1).join(' '); // "08:00 - 11:00"
                                                                    const times = timeParts.split(/[-–—]/); // Handle any hyphens
                                                                    if (times.length === 2) {
                                                                        const start = parseInt(times[0].trim().split(':')[0], 10);
                                                                        let end = parseInt(times[1].trim().split(':')[0], 10);
                                                                        const endMin = parseInt(times[1].trim().split(':')[1], 10);
                                                                        if (endMin > 0) end += 1; // Round up to next hour block if needed

                                                                        const duration = end - start;
                                                                        if (duration > maxDuration) {
                                                                            maxDuration = duration;
                                                                        }
                                                                    }
                                                                });

                                                                skipSlots = Math.max(0, maxDuration - 1);

                                                                return (
                                                                    <td key={slotStr} colSpan={maxDuration} style={{ verticalAlign: 'top', padding: '4px', minWidth: `${maxDuration * 100}px` }}>
                                                                        {items.map(b => (
                                                                            <div
                                                                                key={b.id}
                                                                                className={styles.scheduleItem}
                                                                                title={`${b.lecturerName} - ${b.courseCode} (${b.section})`}
                                                                                onClick={() => setSelectedBooking(b)}
                                                                                style={{ margin: 0, padding: '2px 4px', width: '100%', minHeight: '40px', overflow: 'hidden' }}
                                                                            >
                                                                                <div style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}><strong>{b.courseCode}</strong></div>
                                                                                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>{b.requestedSlot.split(' ').slice(1).join(' ')}</div>
                                                                            </div>
                                                                        ))}
                                                                    </td>
                                                                );
                                                            } else {
                                                                return (
                                                                    <td key={slotStr} style={{ padding: '4px', verticalAlign: 'middle' }}>
                                                                        <div className={styles.emptyBucket} style={{ minHeight: '40px', opacity: 0.3, padding: 0 }} />
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
        )
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Manage Lab Bookings</h1>
                    <p className={styles.subtitle}>Administrative controls for approving and scheduling labs.</p>
                </div>
            </div>

            <div className={styles.tabs}>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'manage' ? styles.tabBtnActive : ''}`}
                    onClick={() => { setActiveTab('manage'); setEditingBooking(null); }}
                >
                    <List size={18} /> Manage Requests
                </button>
                <button
                    className={`${styles.tabBtn} ${activeTab === 'schedule' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    <CalendarIcon size={18} /> Lab Schedule
                </button>
            </div>

            {activeTab === 'manage' && renderManageTab()}
            {activeTab === 'schedule' && renderScheduleTab()}

            {selectedBooking && (
                <div className={styles.modalOverlay} onClick={() => setSelectedBooking(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 style={{ margin: 0, color: 'var(--text-bright)', fontSize: '1.25rem' }}>Booking Details</h3>
                            <button onClick={() => setSelectedBooking(null)} className={styles.actionBtn}>
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.detailRow}><strong>Course:</strong> <span>{selectedBooking.courseCode} ({selectedBooking.program}) - {selectedBooking.section}</span></div>
                            <div className={styles.detailRow}><strong>Lecturer:</strong> <span>{selectedBooking.lecturerName}</span></div>
                            <div className={styles.detailRow}><strong>Email:</strong> <span>{selectedBooking.email}</span></div>
                            <div className={styles.detailRow}><strong>Students:</strong> <span>{selectedBooking.totalStudents}</span></div>
                            <div className={styles.detailRow}><strong>Room:</strong> <span>{selectedBooking.room} ({selectedBooking.campus})</span></div>
                            <div className={styles.detailRow}><strong>Time Slot:</strong> <span>{selectedBooking.requestedSlot}</span></div>
                            <div className={styles.detailRow}><strong>Status:</strong> <span style={{ color: selectedBooking.status === 'approved' ? 'var(--primary)' : 'var(--warning)', fontWeight: 600, textTransform: 'capitalize' }}>{selectedBooking.status}</span></div>
                            <div className={styles.detailRow}><strong>Remarks:</strong> <span>{selectedBooking.remarks || '-'}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Conflict Warning Modal */}
            {conflictInfo && (
                <div className={styles.modalOverlay} onClick={() => setConflictInfo(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', border: '1px solid rgba(248, 81, 73, 0.4)' }}>
                        <div className={styles.modalHeader} style={{ borderBottomColor: 'rgba(248, 81, 73, 0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '42px', height: '42px', borderRadius: '12px',
                                    background: 'rgba(248, 81, 73, 0.15)', border: '1px solid rgba(248, 81, 73, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.25rem'
                                }}>⚠️</div>
                                <div>
                                    <h3 style={{ margin: 0, color: '#ff7b72', fontSize: '1.1rem' }}>
                                        {conflictInfo.type === 'no-room' ? 'ไม่สามารถ Approve ได้' : 'ตารางเวลาชนกัน!'}
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {conflictInfo.type === 'no-room'
                                            ? 'ยังไม่ได้กำหนดห้อง กรุณา Assign Room ก่อน'
                                            : `ไม่สามารถ Approve ได้ เนื่องจาก ${conflictInfo.booking.room} มีการจองที่ชนกัน`
                                        }
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setConflictInfo(null)} className={styles.actionBtn}>
                                <XCircle size={22} />
                            </button>
                        </div>

                        {conflictInfo.type === 'conflict' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                {/* Current request */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>คำขอที่ต้องการ Approve</div>
                                    <div style={{
                                        background: 'rgba(210, 153, 34, 0.1)', border: '1px solid rgba(210, 153, 34, 0.3)',
                                        borderRadius: '10px', padding: '0.875rem'
                                    }}>
                                        <div style={{ fontWeight: 700, color: '#e3b341', marginBottom: '0.25rem' }}>{conflictInfo.booking.courseCode} — {conflictInfo.booking.section}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>{conflictInfo.booking.lecturerName}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            📅 {conflictInfo.booking.requestedSlot} &nbsp;|&nbsp; 🏫 {conflictInfo.booking.room}
                                        </div>
                                    </div>
                                </div>

                                {/* Conflicting bookings */}
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>การจองที่ชนกัน ({conflictInfo.conflicts.length} รายการ)</div>
                                    {conflictInfo.conflicts.map((c, i) => (
                                        <div key={c.id || i} style={{
                                            background: 'rgba(248, 81, 73, 0.08)', border: '1px solid rgba(248, 81, 73, 0.25)',
                                            borderRadius: '10px', padding: '0.875rem', marginBottom: i < conflictInfo.conflicts.length - 1 ? '0.5rem' : 0
                                        }}>
                                            <div style={{ fontWeight: 700, color: '#ff7b72', marginBottom: '0.25rem' }}>{c.courseCode} — {c.section}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-bright)' }}>{c.lecturerName}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                📅 {c.requestedSlot} &nbsp;|&nbsp; 👥 {c.totalStudents} คน
                                                |&nbsp; 🏫 {conflictInfo.booking.room}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {conflictInfo.type === 'no-room' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{
                                    background: 'rgba(248, 81, 73, 0.08)', border: '1px solid rgba(248, 81, 73, 0.25)',
                                    borderRadius: '10px', padding: '1rem', textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏫</div>
                                    <div style={{ fontWeight: 600, color: '#ff7b72', marginBottom: '0.25rem' }}>ยังไม่ได้กำหนดห้องเรียน</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>กรุณากดปุ่ม Edit เพื่อ Assign Room ก่อนทำการ Approve</div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setConflictInfo(null)}
                                style={{
                                    padding: '0.625rem 1.5rem', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-bright)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer'
                                }}
                            >
                                เข้าใจแล้ว
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
