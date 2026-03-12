import { ROOM_STATUSES, CAMPUSES } from './mockData';

export const getCampusList = () => CAMPUSES;

// Real implementation fetching from our own API proxy
export const getRoomStatuses = async (campusId) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout

    try {
        const response = await fetch(`/api/status?campus=${campusId}`, {
            signal: controller.signal,
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Failed to fetch status:", error);
        throw error; // Re-throw so Dashboard can show error state
    } finally {
        clearTimeout(timeoutId);
    }
};

export const checkSystemHealth = async () => {
    return {
        serverRS: 'Online',
        serverBKD: 'Online',
        webPortal: 'Active'
    };
};
