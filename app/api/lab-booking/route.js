import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwfyN8U-i80r7HO2h58oQOjsutFp8yeDC5R1TmwxdRDFazlERJ0Mfy2DwyqmghQ3PAu9w/exec';
const dataFilePath = path.join(process.cwd(), 'data', 'lab-bookings.json');

// Helper to write data (for POST/admin actions)
async function saveBookingsData(data) {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper to read local data (for POST/admin actions to merge with if needed)
async function getLocalBookingsData() {
    try {
        const fileContents = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        return [];
    }
}

// 🟢 NEW: Fetch directly from Google Sheets for the main GET request
export async function GET(request) {
    try {
        // Fetch LIVE data from Google Sheets API with no caching
        const response = await fetch(GOOGLE_SCRIPT_URL, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error('Failed to fetch from Google Sheets');
        }
        
        const googleDocsData = await response.json();
        
        // Map the Google Sheets data to our app's internal format
        const liveBookings = googleDocsData.map((row, index) => {
            const slot = row['Requested Slot'] || '';
            
            // Make room string more forgiving (e.g. "1-301" -> "Lab 1-301")
            let rawRoom = String(row['Room'] || row['room'] || '').trim();
            if (rawRoom && !rawRoom.toLowerCase().startsWith('lab')) {
                rawRoom = `Lab ${rawRoom}`;
            }

            return {
                id: `gsheet-${index}-${row['Timestamp'] || Date.now()}`,
                campus: row['Campus'] || '',
                term: row['Term'] || '',
                year: row['Year']?.toString() || '',
                lecturerName: row['Lecturer Name'] || '',
                email: row['Email'] || '',
                courseCode: row['Course Name'] || '',
                program: row['Program'] || '',
                section: row['Section'] || '',
                totalStudents: parseInt(row['Total Students'] || '0', 10),
                requestedDay: row['Requested Day'] || (slot ? slot.split(' ')[0] : ''),
                requestedSlot: slot,
                remarks: row['Remarks'] || '',
                status: (row['Status'] || '').toLowerCase() || 'pending', // e.g. "approved"
                source: row['Source'] || 'google-sheet',
                room: rawRoom,
                createdAt: row['Timestamp'] || new Date().toISOString()
            };
        });

        return NextResponse.json(liveBookings);
    } catch (error) {
        console.error('Error fetching live from Google Sheets:', error);
        
        // Fallback to local JSON if Google Sheets is unreachable
        const localBookings = await getLocalBookingsData();
        return NextResponse.json(localBookings);
    }
}

export async function POST(request) {
    try {
        const newBooking = await request.json();
        const bookings = await getBookingsData();
        
        // Add ID and timestamp
        const bookingWithMeta = {
            ...newBooking,
            id: `booking-${Date.now()}`,
            createdAt: new Date().toISOString()
        };
        
        bookings.push(bookingWithMeta);
        await saveBookingsData(bookings);
        
        return NextResponse.json({ success: true, booking: bookingWithMeta });
    } catch (error) {
        console.error('Error saving booking:', error);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const updatedBooking = await request.json();
        
        if (!updatedBooking.id) {
            return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
        }
        
        const bookings = await getBookingsData();
        const index = bookings.findIndex(b => b.id === updatedBooking.id);
        
        if (index === -1) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }
        
        // Update the booking, keep createdAt and other unchanged fields
        bookings[index] = { ...bookings[index], ...updatedBooking, updatedAt: new Date().toISOString() };
        await saveBookingsData(bookings);
        
        return NextResponse.json({ success: true, booking: bookings[index] });
    } catch (error) {
        console.error('Error updating booking:', error);
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
        }
        
        const bookings = await getBookingsData();
        const initialLength = bookings.length;
        const filteredBookings = bookings.filter(b => b.id !== id);
        
        if (filteredBookings.length === initialLength) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }
        
        await saveBookingsData(filteredBookings);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting booking:', error);
        return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
    }
}
