import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { autoAssignRoom } from '../../../lib/roomConfig';

const dataFilePath = path.join(process.cwd(), 'data', 'lab-bookings.json');

// Replace with the user's latest deployed Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfyN8U-i80r7HO2h58oQOjsutFp8yeDC5R1TmwxdRDFazlERJ0Mfy2DwyqmghQ3PAu9w/exec';

async function getBookingsData() {
    try {
        const fileContents = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        return [];
    }
}

async function saveBookingsData(data) {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

export async function POST(request) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch from Google Sheets: ${response.statusText}`);
        }
        
        const googleDocsData = await response.json();
        const existingBookings = await getBookingsData();
        
        let newCount = 0;
        let syncedBookings = [...existingBookings];

        for (const row of googleDocsData) {
            // Generate deterministic ID based on timestamp 
            // The Google block saves it as ISO string like "2023-10-27T10:00:00.000Z"
            const timestampStr = row['Timestamp'];
            if (!timestampStr) continue;
            
            const timeVal = new Date(timestampStr).getTime();
            // Fallback unique ID just in case
            const generatedId = `sync-${timeVal}-${row['Course Name']?.replace(/\s/g, '') || 'unknown'}`;
            
            // Check if already exists in local DB
            const isDuplicate = existingBookings.some(b => 
                (b.id === generatedId) || 
                (b.submittedAt === timestampStr && b.courseCode === row['Course Name']) 
            );

            if (!isDuplicate) {
                // Determine auto-assigned room
                const slot = row['Requested Slot'];
                const autoResult = autoAssignRoom(
                    row['Campus'],
                    parseInt(row['Total Students'] || '0', 10),
                    slot,
                    row['Year'],
                    row['Term'],
                    syncedBookings
                );

                const newBooking = {
                    id: generatedId,
                    campus: row['Campus'],
                    term: row['Term'],
                    year: row['Year']?.toString(), // Ensure string
                    lecturerName: row['Lecturer Name'],
                    email: row['Email'],
                    courseCode: row['Course Name'],
                    program: row['Program'],
                    section: row['Section'],
                    totalStudents: parseInt(row['Total Students'] || '0', 10),
                    requestedDay: row['Requested Day'] || (slot ? slot.split(' ')[0] : ''),
                    requestedSlot: slot,
                    remarks: row['Remarks'],
                    status: row['Status'] || 'pending',
                    source: row['Source'] || 'google-sheet-sync',
                    room: autoResult.room || '',
                    initialRoom: autoResult.room || '',
                    createdAt: timestampStr,
                    submittedAt: timestampStr,
                };

                syncedBookings.push(newBooking);
                newCount++;
            }
        }

        if (newCount > 0) {
            await saveBookingsData(syncedBookings);
        }

        return NextResponse.json({ success: true, count: newCount });
    } catch (error) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 });
    }
}
