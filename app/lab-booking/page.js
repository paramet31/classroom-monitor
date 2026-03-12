'use client';

import { useState, useEffect } from 'react';
import styles from './LabBooking.module.css';
import { Play, Save, CheckCircle, XCircle, MapPin, Monitor, Grid, MoreVertical, BookOpen } from 'lucide-react';
import { autoAssignRoom } from '../../lib/roomConfig';

const TIME_OPTIONS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00"
];

export default function LabBookingPage() {
    const [bookings, setBookings] = useState([]);
    
    const [formData, setFormData] = useState({
        campus: 'RS (Rangsit)',
        term: 'Term 1',
        year: '2025',
        lecturerName: '',
        email: '',
        courseCode: '',
        program: '',
        section: 'Sec 1',
        totalStudents: '',
        requestedDay: 'Monday',
        startTime: '08:00',
        endTime: '08:30',
        remarks: ''
    });
    
    // Auto Assignment State
    const [autoAssignResult, setAutoAssignResult] = useState({
        room: null,
        message: 'กรุณากรอก Campus, จำนวนนักศึกษา, และช่วงเวลา',
        isError: false
    });

    useEffect(() => {
        fetchBookings();
    }, []);

    useEffect(() => {
        updateAutoAssignPreview(formData);
    }, [formData, bookings]);

    const fetchBookings = async () => {
        try {
            const res = await fetch('/api/lab-booking');
            if (res.ok) {
                const data = await res.json();
                setBookings(data);
            }
        } catch (error) {
            console.error('Failed to fetch bookings', error);
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updated = { ...prev, [name]: value };
            
            if (name === 'startTime') {
                const startIdx = TIME_OPTIONS.indexOf(value);
                const currentEndIdx = TIME_OPTIONS.indexOf(updated.endTime);
                
                // If the new start time is later than or equal to the current end time, push end time automatically
                if (startIdx >= currentEndIdx) {
                    updated.endTime = TIME_OPTIONS[startIdx + 1] || TIME_OPTIONS[TIME_OPTIONS.length - 1];
                }
            }
            
            return updated;
        });
    };

    const updateAutoAssignPreview = (data) => {
        if (!data.totalStudents || parseInt(data.totalStudents) <= 0) {
            setAutoAssignResult({
                room: null,
                message: 'ระบบจะจัดห้องให้เมื่อระบุจำนวนนักศึกษา และช่วงเวลา',
                isError: false
            });
            return;
        }

        // Keep spaces formatted correctly for the backend check
        let slotForCheck = `${data.requestedDay} ${data.startTime} - ${data.endTime}`;

        const result = autoAssignRoom(
            data.campus,
            data.totalStudents,
            slotForCheck,
            data.year,
            data.term,
            bookings
        );

        setAutoAssignResult({
            room: result.room,
            message: result.message,
            isError: !result.room
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Fix slot formatting for check
        let slotForCheck = `${formData.requestedDay} ${formData.startTime} - ${formData.endTime}`;

        const result = autoAssignRoom(
            formData.campus,
            formData.totalStudents,
            slotForCheck,
            formData.year,
            formData.term,
            bookings
        );

        if (!result.room) {
            alert(result.message);
            return;
        }

        const bookingData = {
            ...formData,
            requestedSlot: slotForCheck, // save as clear text e.g. "Monday Morning"
            room: result.room,
            initialRoom: result.room,
            status: 'pending' // pending until admin approves
        };

        try {
            const res = await fetch('/api/lab-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (res.ok) {
                alert('ส่งคำร้องขอจองห้องสำเร็จแล้ว!\nกรุณารอ Admin อนุมัติยืนยัน');
                setFormData({
                    ...formData,
                    lecturerName: '', email: '', courseCode: '', program: '', totalStudents: '', remarks: ''
                });
                fetchBookings();
            } else {
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to submit booking');
        }
    };

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Compute valid End Time options so user can't pick times <= Start Time
    const startIdx = TIME_OPTIONS.indexOf(formData.startTime);
    const validEndTimeOptions = startIdx !== -1 ? TIME_OPTIONS.slice(startIdx + 1) : TIME_OPTIONS;

    return (
        <div className={styles.pageWrapper}>
            <header className={styles.topHeader}>
                <div className={styles.breadcrumbs}>
                    <MapPin size={18} /> Lab Booking <span className={styles.separator}>/</span> New Request
                </div>
                <div className={styles.headerLinks}>
                    <span>Course</span>
                    <span>Interviews</span>
                    <span>Resources</span>
                    <span>Account ⌵</span>
                </div>
            </header>

            <div className={styles.mainContent}>
                {/* Left Section - Hero and Form */}
                <div className={styles.formSection}>
                    <div className={styles.heroBanner}></div>
                    
                    <div className={styles.heroContent}>
                        <div className={styles.titleWrapper}>
                            <div className={styles.iconCircle}>
                                <Play size={20} fill="currentColor" style={{marginLeft: '3px'}}/>
                            </div>
                            <h1 className={styles.mainTitle}>Booking Request</h1>
                        </div>
                        
                        <p className={styles.description}>
                            A comprehensive journey that helps you navigate room scheduling and make allocations aligned with total students and campus locations.
                        </p>
                        
                        <div className={styles.metaInfo}>
                            <span><Grid className={styles.metaIcon} size={16}/> Auto-assign Mode</span>
                            <span><Monitor className={styles.metaIcon} size={16}/> Windows Environments</span>
                            <span><MapPin className={styles.metaIcon} size={16}/> SIIT Campus</span>
                        </div>

                        {/* If we weren't doing auto-assign, there would be a Start button here. We skip to the form. */}
                        
                        <hr className={styles.divider} />
                        
                        <h2 className={styles.sectionTitle}>
                            <span style={{fontSize: '0.9rem', color: '#666', marginRight: '1rem'}}>Part 1</span>
                            Orientation: Understanding Your Requirements
                        </h2>
                        <p className={styles.description} style={{fontSize: '0.9rem', marginBottom: '2rem'}}>
                            You need to know where you're allocating resources from before submitting a request. Fill all fields below.
                        </p>

                        <form>
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Campus</label>
                                    <select name="campus" value={formData.campus} onChange={handleFormChange} className={styles.select}>
                                        <option value="RS (Rangsit)">RS (Rangsit)</option>
                                        <option value="BKD (Bangkadi)">BKD (Bangkadi)</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Term</label>
                                    <select name="term" value={formData.term} onChange={handleFormChange} className={styles.select}>
                                        <option value="Term 1">Term 1</option>
                                        <option value="Term 2">Term 2</option>
                                        <option value="Term 3">Term 3</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Year</label>
                                    <select name="year" value={formData.year} onChange={handleFormChange} className={styles.select}>
                                        <option value="2025">2025</option>
                                        <option value="2026">2026</option>
                                        <option value="2027">2027</option>
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Lecturer Name</label>
                                    <input required type="text" name="lecturerName" value={formData.lecturerName} onChange={handleFormChange} className={styles.input} placeholder="e.g. Dr. Somchai" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Email</label>
                                    <input required type="email" name="email" value={formData.email} onChange={handleFormChange} className={styles.input} placeholder="lecturer@siit.tu.ac.th" />
                                </div>
                            </div>

                            <div className={styles.formGrid} style={{gridTemplateColumns: '2fr 1fr 1fr 1fr'}}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Course Code</label>
                                    <input required type="text" name="courseCode" value={formData.courseCode} onChange={handleFormChange} className={styles.input} placeholder="e.g. CSS322" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Program</label>
                                    <input required type="text" name="program" value={formData.program} onChange={handleFormChange} className={styles.input} placeholder="e.g. IT" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Section</label>
                                    <select name="section" value={formData.section} onChange={handleFormChange} className={styles.select}>
                                        {[...Array(10)].map((_, i) => <option key={i} value={`Sec ${i+1}`}>Sec {i+1}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Total Students <span style={{color: '#e11d48'}}>*</span></label>
                                    <input required type="number" name="totalStudents" value={formData.totalStudents} onChange={handleFormChange} className={styles.input} placeholder="0" />
                                </div>
                            </div>

                            <div className={styles.formGrid} style={{gridTemplateColumns: '1fr 1fr 1fr'}}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Requested Day <span style={{color: '#e11d48'}}>*</span></label>
                                    <select name="requestedDay" value={formData.requestedDay} onChange={handleFormChange} className={styles.select}>
                                        {days.map(day => (
                                            <option key={day} value={day}>{day}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Start Time <span style={{color: '#e11d48'}}>*</span></label>
                                    <select name="startTime" value={formData.startTime} onChange={handleFormChange} className={styles.select}>
                                        {TIME_OPTIONS.slice(0, TIME_OPTIONS.length - 1).map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>End Time <span style={{color: '#e11d48'}}>*</span></label>
                                    <select name="endTime" value={formData.endTime} onChange={handleFormChange} className={styles.select}>
                                        {validEndTimeOptions.map(slot => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Remarks (Optional)</label>
                                <textarea name="remarks" value={formData.remarks} onChange={handleFormChange} className={styles.textarea} placeholder="Any specific requirements..."></textarea>
                            </div>

                            <div style={{marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid #eaeaea', paddingTop: '2rem'}}>
                                <div className={styles.metaInfo} style={{fontSize: '0.85rem', marginBottom: '0'}}>
                                    <span><Grid className={styles.metaIcon} size={14}/> Auto-assign Mode</span>
                                    <span><Monitor className={styles.metaIcon} size={14}/> Live Sync</span>
                                </div>
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid #eaeaea'}}>
                                    <div>
                                        <div style={{fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem'}}>Status</div>
                                        <div style={{fontSize: '1rem', fontWeight: 600, color: autoAssignResult.isError ? '#e11d48' : '#111', maxWidth: '400px'}}>
                                            {autoAssignResult.isError ? autoAssignResult.message : 'Ready to submit'}
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        className={styles.blackBtn} 
                                        disabled={autoAssignResult.isError} 
                                        onClick={handleSubmit}
                                    >
                                        <Play size={14} fill="currentColor" /> Submit Request
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
