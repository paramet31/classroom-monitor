import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { autoAssignRoom } from '../../../lib/roomConfig';

const dataFilePath = path.join(process.cwd(), 'data', 'lab-bookings.json');

// Replace with the user's latest deployed Web App URL
// Use environment variable for the script URL
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_LAB_URL || process.env.GOOGLE_APPS_SCRIPT_URL;

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
            // Handle both Title Case (from Sheet) and camelCase (from Standalone Form JSON)
            const timestampStr = row['Timestamp'] || row['submittedAt'];
            if (!timestampStr) continue;
            
            const timeVal = new Date(timestampStr).getTime();
            const courseName = row['Course Name'] || row['courseName'];
            // Fallback unique ID just in case
            const generatedId = `sync-${timeVal}-${courseName?.replace(/\s/g, '') || 'unknown'}`;
            
            // Check if already exists in local DB
            const isDuplicate = existingBookings.some(b => 
                (b.id === generatedId) || 
                (b.submittedAt === timestampStr && b.courseCode === courseName) 
            );

            if (!isDuplicate) {
                // Determine auto-assigned room
                const slot = row['Requested Slot'] || row['requestedSlot'];
                const totalStudents = parseInt(row['Total Students'] || row['totalStudents'] || '0', 10);
                const campus = row['Campus'] || row['campus'];
                const year = row['Year'] || row['year'];
                const term = row['Term'] || row['term'];

                const autoResult = autoAssignRoom(
                    campus,
                    totalStudents,
                    slot,
                    year,
                    term,
                    syncedBookings
                );

                const newBooking = {
                    id: generatedId,
                    campus: campus,
                    term: term,
                    year: year?.toString(), // Ensure string
                    lecturerName: row['Lecturer Name'] || row['lecturerName'],
                    email: row['Email'] || row['email'],
                    courseCode: courseName,
                    program: row['Program'] || row['program'],
                    section: row['Section'] || row['section'],
                    totalStudents: totalStudents,
                    requestedDay: row['Requested Day'] || row['requestedDay'] || (slot ? slot.split(' ')[0] : ''),
                    requestedSlot: slot,
                    remarks: row['Remarks'] || row['remarks'],
                    status: row['Status'] || row['status'] || 'pending',
                    source: row['Source'] || row['source'] || 'google-sheet-sync',
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
