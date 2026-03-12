// fetch is a global in Node 18+ — no import needed

const CRRS_BASE = 'https://crrs.siit.tu.ac.th/calendar/index.php';

// CRRS uses area IDs:  3 = Classrooms,  4 = Computer Labs
const CRRS_AREAS = [3, 4];

// In-memory cache: { dateKey: { timestamp, data } }
let scheduleCache = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch HTML from the CRRS calendar with a timeout.
 */
async function fetchCRRS(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
                'Accept': 'text/html',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (e) {
        console.error(`[ScheduleScraper] Fetch error for ${url}:`, e.message);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Parse the CRRS day-view HTML and extract schedule per room.
 * Returns: { "1-306": [ { start: "09:00", end: "12:00", name: "MES301 S.1" } ], ... }
 */
function parseDayViewHtml(html) {
    if (!html) return {};

    // 1. Extract ordered list of room names from the header row
    //    Pattern: <th data-room="XX"><a ...>CRRS-ROOMNAME<span>CAPACITY</span></a></th>
    const roomOrder = [];
    const headerRegex = /<th\s+data-room="(\d+)"[^>]*>[\s\S]*?CRRS-([^<\d][^<]*?)(?:<span|<\/a)/g;
    let hm;
    while ((hm = headerRegex.exec(html)) !== null) {
        roomOrder.push(hm[2].trim());
    }

    if (roomOrder.length === 0) {
        // Fallback: try simpler pattern
        const simpleRegex = /data-room="\d+"[^>]*><a[^>]*>CRRS-([^<]+)/g;
        let sm;
        while ((sm = simpleRegex.exec(html)) !== null) {
            // Remove trailing numbers that are the capacity
            const raw = sm[1].trim();
            // Room names like "1-40190" → need to extract "1-401" (remove capacity digits)
            // The pattern is: room name is formatted as CRRS-{roomName}{capacity}
            // Since we can't easily separate, we'll handle this differently
            roomOrder.push(raw);
        }
    }

    // 2. Find <tbody> and walk each <tr>
    const tbodyIdx = html.indexOf('<tbody');
    if (tbodyIdx < 0) return {};

    const tbodyHtml = html.substring(tbodyIdx);

    // Track active bookings per column (for rowspan handling)
    // activeBookings[colIdx] = { name, remainingRows, startSeconds }
    const activeBookings = new Array(roomOrder.length).fill(null);

    // Result: per room, list of raw slots {startSec, endSec, name}
    const rawSlots = {};
    roomOrder.forEach(r => { rawSlots[r] = []; });

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch;
    const SLOT_DURATION = 1800; // 30 minutes in seconds

    while ((trMatch = trRegex.exec(tbodyHtml)) !== null) {
        const rowHtml = trMatch[1];

        // Get time from the <th data-seconds="XXXXX">
        const timeMatch = rowHtml.match(/<th\s+data-seconds="(\d+)"/);
        if (!timeMatch) continue;
        const timeSec = parseInt(timeMatch[1]);

        // Get all <td> cells in this row (in order)
        const tdRegex = /<td[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/g;
        let tdMatch;
        let colIdx = 0;

        // First, decrement remaining rows for active bookings
        // and skip columns that are still occupied by a previous rowspan
        const cellsInRow = [];
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
            const cellClass = tdMatch[1];
            const cellContent = tdMatch[2];
            const rowspanMatch = tdMatch[0].match(/rowspan="(\d+)"/);
            const rowspan = rowspanMatch ? parseInt(rowspanMatch[1]) : 1;
            cellsInRow.push({ cellClass, cellContent, rowspan });
        }

        // Map cells to columns, accounting for active rowspans
        let cellReadIdx = 0;
        for (let col = 0; col < roomOrder.length; col++) {
            // If this column is occupied by a previous rowspan
            if (activeBookings[col] && activeBookings[col].remainingRows > 0) {
                activeBookings[col].remainingRows--;
                // The slot is still part of the ongoing booking
                continue;
            }

            // Consume the next cell from the row
            if (cellReadIdx >= cellsInRow.length) break;
            const cell = cellsInRow[cellReadIdx];
            cellReadIdx++;

            if (cell.cellClass.includes('booked')) {
                // Extract entry name
                const titleMatch = cell.cellContent.match(/title="([^"]+)"/);
                const linkTextMatch = cell.cellContent.match(/>([^<]+)<\/a>/);
                let name = titleMatch ? titleMatch[1] : (linkTextMatch ? linkTextMatch[1] : '');
                name = name.trim();

                // Skip OPEN and CLOSE_ALL entries - they are not real classes
                if (name === 'OPEN' || name === 'CLOSE_ALL' || name.startsWith('CLOSE')) {
                    activeBookings[col] = cell.rowspan > 1 ? { name, remainingRows: cell.rowspan - 1, startSeconds: timeSec } : null;
                    continue;
                }

                // Record the slot
                if (name && roomOrder[col]) {
                    rawSlots[roomOrder[col]].push({
                        startSec: timeSec,
                        endSec: timeSec + (cell.rowspan * SLOT_DURATION),
                        name
                    });
                }

                // Track for rowspan
                if (cell.rowspan > 1) {
                    activeBookings[col] = { name, remainingRows: cell.rowspan - 1, startSeconds: timeSec };
                } else {
                    activeBookings[col] = null;
                }
            } else {
                activeBookings[col] = null;
            }
        }
    }

    // 3. Merge overlapping/adjacent slots with same name
    const result = {};
    for (const [room, slots] of Object.entries(rawSlots)) {
        if (slots.length === 0) continue;

        // Sort by start time
        slots.sort((a, b) => a.startSec - b.startSec);

        const merged = [slots[0]];
        for (let i = 1; i < slots.length; i++) {
            const prev = merged[merged.length - 1];
            const curr = slots[i];
            // Merge if same name and adjacent/overlapping
            if (curr.name === prev.name && curr.startSec <= prev.endSec) {
                prev.endSec = Math.max(prev.endSec, curr.endSec);
            } else {
                merged.push(curr);
            }
        }

        result[room] = merged.map(s => ({
            start: secondsToHHMM(s.startSec),
            end: secondsToHHMM(s.endSec),
            name: s.name
        }));
    }

    return result;
}

function secondsToHHMM(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Get today's schedule for all rooms.
 * Returns: { "1-306": [{start, end, name}], "1-312": [...], ... }
 */
export async function getScheduleForToday() {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // Check cache
    if (scheduleCache[dateStr] && (Date.now() - scheduleCache[dateStr].timestamp) < CACHE_TTL_MS) {
        return scheduleCache[dateStr].data;
    }

    console.log(`[ScheduleScraper] Fetching CRRS schedule for ${dateStr}...`);

    const allSchedules = {};

    for (const area of CRRS_AREAS) {
        const url = `${CRRS_BASE}?view=day&page_date=${dateStr}&area=${area}`;
        const html = await fetchCRRS(url);
        const parsed = parseDayViewHtml(html);

        // Merge into allSchedules
        for (const [room, entries] of Object.entries(parsed)) {
            if (!allSchedules[room]) allSchedules[room] = [];
            allSchedules[room].push(...entries);
        }
    }

    // Cache it
    scheduleCache[dateStr] = { timestamp: Date.now(), data: allSchedules };
    console.log(`[ScheduleScraper] Cached schedule for ${dateStr}: ${Object.keys(allSchedules).length} rooms`);

    return allSchedules;
}

/**
 * Check if a room is currently scheduled (has a class right now).
 */
export function isRoomScheduledNow(roomSchedule) {
    if (!roomSchedule || roomSchedule.length === 0) return false;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    return roomSchedule.some(entry => {
        const [startH, startM] = entry.start.split(':').map(Number);
        const [endH, endM] = entry.end.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        return nowMinutes >= startMin && nowMinutes < endMin;
    });
}
