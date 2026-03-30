import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GOOGLE_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_LAB_URL || process.env.GOOGLE_APPS_SCRIPT_URL;

export async function GET() {
    try {
        if (!GOOGLE_SCRIPT_URL) {
            console.error('Missing Google Apps Script URL in environment variables');
            return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
        }

        const response = await fetch(GOOGLE_SCRIPT_URL, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch from Google Sheets: ${response.statusText}`);
        }
        
        const googleDocsData = await response.json();
        
        const bookings = googleDocsData.map(row => {
            const timestampStr = row['Timestamp'] || row['submittedAt'];
            const timeVal = timestampStr ? new Date(timestampStr).getTime() : Date.now();
            const courseName = row['Course Name'] || row['courseName'];
            const generatedId = `sync-${timeVal}-${courseName ? String(courseName).replace(/\\s/g, '') : 'unknown'}`;
            
            const slot = row['Requested Slot'] || row['requestedSlot'];
            const sheetRoom = row['Room'] || row['room'] || '';
            const properlyFormattedRoom = String(sheetRoom).startsWith('Lab ') ? String(sheetRoom) : (sheetRoom ? `Lab ${sheetRoom}` : '');
            
            return {
                id: generatedId,
                campus: row['Campus'] || row['campus'],
                term: row['Term'] || row['term'],
                year: String(row['Year'] || row['year'] || ''),
                lecturerName: row['Lecturer Name'] || row['lecturerName'],
                courseCode: courseName,
                section: row['Section'] || row['section'],
                requestedDay: row['Requested Day'] || row['requestedDay'] || (slot ? slot.split(' ')[0] : ''),
                requestedSlot: slot,
                status: (row['Status'] || row['status'] || 'pending').toLowerCase(),
                room: properlyFormattedRoom,
            };
        });

        return NextResponse.json(bookings);
    } catch (error) {
        console.error('Error fetching direct Google Sheets bookings:', error);
        return NextResponse.json([], { status: 500 });
    }
}
