/**
 * Room Auto-Assignment Configuration & Logic
 * ============================================
 * Implements first-come-first-serve room assignment based on:
 *   - Campus (RS / BKD)
 *   - Total number of students
 *   - Availability in the requested time slot
 */

export const ROOMS = [
    "Lab 1-301",
    "Lab 1-304",
    "Lab 1-306",
    "Lab 1-307",
    "Lab 3201",
    "Lab 3202"
];

const ROOM_ASSIGNMENT_RULES = {
    "RS": [
        { min: 1,  max: 40, rooms: ["Lab 1-307", "Lab 1-301", "Lab 1-304", "Lab 1-306"] },
        { min: 41, max: 52, rooms: ["Lab 1-301", "Lab 1-304", "Lab 1-306", "Lab 1-307"] },
        { min: 53, max: 65, rooms: ["Lab 1-306", "Lab 1-301", "Lab 1-304", "Lab 1-307"] },
    ],
    "BKD": [
        { min: 1,  max: 40, rooms: ["Lab 3201", "Lab 3202"] },
        { min: 41, max: 53, rooms: ["Lab 3201", "Lab 3202"] },
        { min: 54, max: 65, rooms: ["Lab 3202", "Lab 3201"] },
    ]
};

export function getCampusCode(campusValue) {
    if (!campusValue) return null;
    if (campusValue.startsWith("RS")) return "RS";
    if (campusValue.startsWith("BKD")) return "BKD";
    return null;
}

export function getRoomCandidates(campusCode, totalStudents) {
    const rules = ROOM_ASSIGNMENT_RULES[campusCode];
    if (!rules) return null;

    const students = parseInt(totalStudents);
    if (isNaN(students) || students <= 0) return null;

    for (const rule of rules) {
        if (students >= rule.min && students <= rule.max) {
            return [...rule.rooms];
        }
    }
    return null;
}

/**
 * Parse a time period string like "09:30 - 12:30" into { startMinutes, endMinutes }
 * Returns null if parsing fails.
 */
export function parseTimePeriod(period) {
    if (!period) return null;
    const parts = period.split(/\s*[-–—]\s*/);
    if (parts.length !== 2) return null;

    const parseTime = (t) => {
        const [h, m] = t.trim().split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
    };

    const start = parseTime(parts[0]);
    const end = parseTime(parts[1]);
    if (start === null || end === null) return null;
    return { startMinutes: start, endMinutes: end };
}

/**
 * Check if two time ranges overlap.
 * Two ranges [s1,e1) and [s2,e2) overlap if s1 < e2 && s2 < e1
 */
function timeRangesOverlap(period1, period2) {
    const t1 = parseTimePeriod(period1);
    const t2 = parseTimePeriod(period2);
    if (!t1 || !t2) return false;
    return t1.startMinutes < t2.endMinutes && t2.startMinutes < t1.endMinutes;
}

export function isRoomOccupied(room, requestedDay, requestedPeriod, year, term, existingBookings) {
    return existingBookings.some(b => {
        if (b.status !== 'approved') return false;
        if (b.room !== room) return false;
        if (b.year !== year || b.term !== term) return false;

        const bSlot = parseRequestedSlot(b.requestedSlot);
        if (!bSlot) return false;

        if (bSlot.day !== requestedDay) return false;

        return timeRangesOverlap(bSlot.period, requestedPeriod);
    });
}

/**
 * Find all approved bookings that conflict with the given slot.
 * Returns an array of conflicting booking objects.
 */
export function findConflictingBookings(room, requestedDay, requestedPeriod, year, term, existingBookings) {
    return existingBookings.filter(b => {
        if (b.status !== 'approved') return false;
        if (b.room !== room) return false;
        if (b.year !== year || b.term !== term) return false;

        const bSlot = parseRequestedSlot(b.requestedSlot);
        if (!bSlot) return false;

        if (bSlot.day !== requestedDay) return false;

        return timeRangesOverlap(bSlot.period, requestedPeriod);
    });
}

export function parseRequestedSlot(slotValue) {
    if (!slotValue) return null;
    const parts = slotValue.split(' ');
    if (parts.length < 2) return null;
    return { day: parts[0], period: parts.slice(1).join(' ') };
}

export function autoAssignRoom(campus, totalStudents, requestedSlot, year, term, existingBookings, excludeBookingId = null) {
    const campusCode = getCampusCode(campus);
    if (!campusCode) {
        return { room: null, message: "กรุณาเลือก Campus", allCandidates: [] };
    }

    const candidates = getRoomCandidates(campusCode, totalStudents);
    if (!candidates) {
        const students = parseInt(totalStudents);
        if (isNaN(students) || students <= 0) {
            return { room: null, message: "กรุณากรอกจำนวนนักศึกษา", allCandidates: [] };
        }
        return { room: null, message: `จำนวนนักศึกษา ${students} คน เกินจำนวนที่รองรับได้ (สูงสุด 65 คน)`, allCandidates: [] };
    }

    const slot = parseRequestedSlot(requestedSlot);
    if (!slot) {
        return { room: candidates[0], message: `ห้องแนะนำ: ${candidates[0]} (ยังไม่ได้เลือกช่วงเวลา)`, allCandidates: candidates };
    }

    const bookingsToCheck = excludeBookingId
        ? existingBookings.filter(b => b.id !== excludeBookingId)
        : existingBookings;

    for (const room of candidates) {
        if (!isRoomOccupied(room, slot.day, slot.period, year, term, bookingsToCheck)) {
            return { room, message: `ห้องที่ได้: ${room}`, allCandidates: candidates };
        }
    }

    return {
        room: null,
        message: `⚠️ ไม่มีห้องว่างในช่วง ${slot.day} ${slot.period} — กรุณาเลือกช่วงเวลาอื่น`,
        allCandidates: candidates
    };
}
