import axiosInstance, { noAuthInstance } from '../utils/axios';
import { UserDetails } from '../components/cards/memberCard/MemberCard'; // Import UserDetails
import { Event } from './OrgService'; // Assuming Event type is defined in OrgService

// Interface matching the backend EventUser model (if needed elsewhere)
export interface EventUser {
    PK: string; // USER#<ID>
    SK: string; // EVENT#<ID>
    id: string; // Event ID
    GSI2PK: string; // EVENT#<ID>
    GSI2SK: string; // USER#<ID>
    // Add other EventUser fields if they exist in your backend model
    joinDate?: string; // Example: if join date is part of EventUser
    role?: string; // Example: if role is part of EventUser
    organizationName?: string; // Example
}

// Interface matching the backend AttendeeWithDetails structure
export interface AttendeeWithDetailsResponse {
     attendeeInfo: EventUser;
     userDetails: UserDetails | null;
}

// Updated Response structure for the GET /organizations/:orgId/events/:eventId endpoint
export interface EventWithAttendeesResponse {
    status: string;
    data: {
        event: Event; // Assuming Event type is defined elsewhere (e.g., in OrgService.tsx)
        attendees: AttendeeWithDetailsResponse[];
    };
}

// Interface for the POST /organizations/:orgId/events/:eventId response
export interface EventUserResponse {
    status: string;
    data: {
        userEvent: EventUser;
    };
}


/**
 * Attend an event - creates an attendance record
 * @param orgId Organization ID
 * @param eventId Event ID
 * @returns Response with created attendance record
 */
export const attendEvent = async (orgId: string, eventId: string): Promise<EventUserResponse> => {
    try {
        const response = await axiosInstance.post<EventUserResponse>(
            `/organizations/${orgId}/events/${eventId}`
        );
        console.log('Attend event response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error attending event:', error);
        throw error;
    }
};

/**
 * Get details for a specific event *and* its attendees with their details
 * @param orgId Organization ID
 * @param eventId Event ID
 * @returns Event details and an array of attendees with user details
 */
export const getEventDetailsWithAttendees = async (orgId: string, eventId: string): Promise<EventWithAttendeesResponse> => {
    try {
        console.log(`Fetching details and attendees for event ${eventId} in org ${orgId}`);
        const response = await axiosInstance.get<EventWithAttendeesResponse>(
            `/organizations/${orgId}/events/${eventId}`
        );
        console.log('Event details and attendees response:', response.data);
        // Ensure attendees array exists, even if empty
        if (!response.data?.data?.attendees) {
            response.data.data.attendees = [];
        }
        return response.data;
    } catch (error) {
        console.error('Error fetching event details and attendees:', error);
        throw error; // Re-throw the error to be handled by the caller
    }
};


// Note: The original getEventAttendees function that returned only IDs might be redundant now.
// Consider removing it if it's no longer used anywhere, or keep it if needed for other purposes.
/**
 * Get all attendee IDs for an event (Might be deprecated)
 * @param orgId Organization ID
 * @param eventId Event ID
 * @returns Array of user IDs for attendees (e.g., ["userId1", "userId2"])
 */
export const getEventAttendees = async (orgId: string, eventId: string): Promise<string[]> => {
    console.warn("getEventAttendees returning only IDs might be deprecated. Use getEventDetailsWithAttendees instead.");
    try {
        // Assuming the main endpoint now returns details, we fetch details and extract IDs
        const response = await getEventDetailsWithAttendees(orgId, eventId);
        return response.data.attendees
            .map(att => att.userDetails?.id) // Get the ID from userDetails
            .filter((id): id is string => !!id); // Filter out any null/undefined IDs
    } catch (error) {
        console.error('Error fetching event attendee IDs (via details endpoint):', error);
        return []; // Return empty array on error
    }
};
