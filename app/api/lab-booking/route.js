import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Use environment variable for the script URL
const GOOGLE_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;
const dataFilePath = path.join(process.cwd(), 'data', 'lab-bookings.json');

// Helper to write data (for POST/admin actions)
async function saveBookingsData(data) {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
}

// Helper to read local data
async function getBookingsData() {
    try {
        const fileContents = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(fileContents);
    } catch (error) {
        return [];
    }
}

// GET: Return local persistent data (which includes synced items + admin edits)
export async function GET(request) {
    try {
        const bookings = await getBookingsData();
        console.log(`[API Lab-Booking GET] Serving ${bookings.length} bookings from local JSON`);
        return NextResponse.json(bookings);
    } catch (error) {
        console.error('Error fetching lab bookings:', error);
        return NextResponse.json([], { status: 500 });
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
        console.log(`[API Lab-Booking PUT] Updating booking ${updatedBooking.id}`, updatedBooking);
        
        if (!updatedBooking.id) {
            return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
        }
        
        const bookings = await getBookingsData();
        const index = bookings.findIndex(b => b.id === updatedBooking.id);
        
        if (index === -1) {
            console.error(`[API Lab-Booking PUT] Booking ${updatedBooking.id} not found in local JSON`);
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }
        
        // Update the booking, keep createdAt and other unchanged fields
        bookings[index] = { ...bookings[index], ...updatedBooking, updatedAt: new Date().toISOString() };
        await saveBookingsData(bookings);
        console.log(`[API Lab-Booking PUT] Successfully saved booking ${updatedBooking.id}`);
        
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
