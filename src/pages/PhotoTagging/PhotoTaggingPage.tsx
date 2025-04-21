// src/pages/PhotoTagging/PhotoTaggingPage.tsx
import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Button, Alert, Spinner } from 'react-bootstrap';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import * as icon from 'react-bootstrap-icons';
import AuthContext from '../../context/AuthContext';

// Import components
import Sidebar from '../../components/bars/SideBar/SideBar';
import TopBar from '../../components/bars/TopBar/TopBar';
import SearchBar from '../../components/bars/SearchBar/SearchBar';
import NavButton from '../../components/navButton/NavButton';
import MemberCard from '../../components/cards/memberCard/MemberCard';
import axiosInstance from '../../utils/axios';
import { getEventAttendees } from '../../context/EventService'; // Assuming this function returns user IDs or basic info

// Define types for our data models
interface UserDetails {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

// Combining Member and EventAttendee concepts for clarity on this page
interface AttendeeForTagging {
    PK: string; // Primary Key format (e.g., USER#userId)
    SK: string; // Sort Key format (e.g., EVENT#eventId)
    userId: string;
    role: string; // Role within the organization (might not be directly relevant here but good to have)
    joinDate?: string; // Join date for the organization (might not be directly relevant here)
    organizationName: string;
    eventId: string; // Added eventId for context
    userDetails: UserDetails | null; // UserDetails can be null initially while loading
    isLoadingDetails?: boolean; // Flag to indicate if details are being fetched
}

const PhotoTaggingPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: orgId, eid: eventId, photoId } = useParams();
    const { user, token } = useContext(AuthContext);

    // State for search and members
    const [searchTerm, setSearchTerm] = useState('');
    const [attendees, setAttendees] = useState<AttendeeForTagging[]>([]); // Use the combined type
    const [filteredAttendees, setFilteredAttendees] = useState<AttendeeForTagging[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [eventName, setEventName] = useState<string>('');

    // Pagination state - modified for better scrolling experience
    const [initialDisplayCount] = useState<number>(12); // Initial number to display
    const [displayCount, setDisplayCount] = useState<number>(12); // Current display count
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Helper function to fetch details for a single user ID
    const fetchUserDetails = async (userId: string): Promise<UserDetails | null> => {
        try {
            // Check if it's the current user to optimize
            if (user && userId === user.id) {
                return {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                };
            }
            // Fetch details from the API
            const userResponse = await axiosInstance.get(`/users/${userId}`);
            const userData = userResponse.data?.data?.user;
            if (userData && userData.firstName && userData.lastName) {
                return {
                    id: userId,
                    email: userData.email || `${userId}@unknown.com`, // Provide fallback email
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                };
            }
            console.warn(`Could not fetch full details for user ${userId}`);
            return null; // Return null if details are incomplete or fetch failed
        } catch (userError) {
            console.error(`Error fetching details for user ${userId}:`, userError);
            return null; // Return null on error
        }
    };

    // Fetch initial list of attendee IDs and then fetch details
    useEffect(() => {
        const fetchInitialAttendees = async () => {
            if (!orgId || !eventId || !photoId) {
                setError('Missing organization, event, or photo ID');
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Fetch event name (optional, but good for context)
                try {
                    const eventResponse = await axiosInstance.get(
                        `/organizations/${orgId}/events/${eventId}`
                    );
                    setEventName(eventResponse.data?.data?.event?.title || 'Event');
                } catch (eventError) {
                    console.warn('Could not fetch event name:', eventError);
                    setEventName('Event');
                }

                // Fetch the list of attendee IDs
                const attendeeIds = await getEventAttendees(orgId, eventId);

                if (!attendeeIds || attendeeIds.length === 0) {
                    setAttendees([]);
                    setFilteredAttendees([]);
                    setHasMore(false);
                    setLoading(false);
                    return;
                }

                // Create initial attendee objects with loading state
                const initialAttendeeList: AttendeeForTagging[] = attendeeIds.map(attIdInfo => {
                    let userId = '';
                    if (typeof attIdInfo === 'string') {
                        userId = attIdInfo.includes('#') ? attIdInfo.split('#')[1] : attIdInfo;
                    } else if (attIdInfo && typeof attIdInfo === 'object') {
                        userId = (attIdInfo as any).userId || '';
                    }

                    return {
                        PK: `USER#${userId}`,
                        SK: `EVENT#${eventId}`,
                        userId: userId,
                        role: 'MEMBER', // Default role, might need adjustment if role info is available
                        organizationName: orgId,
                        eventId: eventId,
                        userDetails: null, // Start with null details
                        isLoadingDetails: true, // Mark as loading
                    };
                }).filter(att => att.userId); // Ensure we have a valid userId

                setAttendees(initialAttendeeList);
                setFilteredAttendees(initialAttendeeList); // Initially show all (loading)
                setDisplayCount(Math.min(initialAttendeeList.length, initialDisplayCount));
                setHasMore(initialAttendeeList.length > initialDisplayCount);
                setLoading(false); // Initial list is ready (though details might still be loading)

                // Now, fetch details for each attendee asynchronously
                initialAttendeeList.forEach(async (attendee) => {
                    const details = await fetchUserDetails(attendee.userId);
                    setAttendees(prev =>
                        prev.map(a =>
                            a.userId === attendee.userId
                                ? { ...a, userDetails: details, isLoadingDetails: false }
                                : a
                        )
                    );
                });

            } catch (err) {
                console.error('Error fetching attendees:', err);
                setError('Failed to load event attendees. Please try again later.');
                setAttendees([]);
                setFilteredAttendees([]);
                setHasMore(false);
                setLoading(false);
            }
        };

        fetchInitialAttendees();
    }, [orgId, eventId, photoId, initialDisplayCount, user]); // Add `user` dependency

    // Filter attendees based on search term and details loading state
    useEffect(() => {
        const applyFilter = () => {
            let filtered = attendees;

            if (searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                filtered = attendees.filter((attendee: AttendeeForTagging) => {
                    // Search even if details are loading (search by ID)
                    if (attendee.isLoadingDetails) {
                        return attendee.userId.toLowerCase().includes(searchLower);
                    }
                    // Search by name/email if details are loaded
                    if (attendee.userDetails) {
                        const { firstName, lastName, email } = attendee.userDetails;
                        const fullName = `${firstName} ${lastName}`.toLowerCase();
                        return fullName.includes(searchLower) || email.toLowerCase().includes(searchLower);
                    }
                    // Fallback if details couldn't be loaded
                    return attendee.userId.toLowerCase().includes(searchLower);
                });
            }

            setFilteredAttendees(filtered);
            // Adjust display count and hasMore based on the *filtered* list
            setDisplayCount(Math.min(filtered.length, initialDisplayCount));
            setHasMore(filtered.length > initialDisplayCount);
        };

        applyFilter();

    }, [attendees, searchTerm, initialDisplayCount]); // Rerun filter when attendees data updates (details load)

    // Get the currently visible members based on display count
    const visibleAttendees = filteredAttendees.slice(0, displayCount);

    // Handle load more function
    const handleLoadMore = () => {
        setLoadingMore(true);
        const newDisplayCount = Math.min(displayCount + initialDisplayCount, filteredAttendees.length);
        setDisplayCount(newDisplayCount);
        setHasMore(newDisplayCount < filteredAttendees.length);
        // Simulate delay if needed, otherwise just update state
        setTimeout(() => setLoadingMore(false), 200); // Short delay for visual feedback
    };

    // Handle search change
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        // Reset display count when search term changes to show initial results of the search
        setDisplayCount(initialDisplayCount);
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    // Toggle member selection
    const handleMemberSelect = (userId: string) => {
        setSelectedMembers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    // Submit tags
    const handleSubmitTags = async () => {
        if (selectedMembers.length === 0) {
            setError('Please select at least one member to tag');
            return;
        }

        if (!orgId || !eventId || !photoId) {
            setError('Missing organization, event, or photo ID');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setSuccess(null); // Clear previous success message

            const response = await axiosInstance.post(
                `/organizations/${orgId}/events/${eventId}/photos/${photoId}/tags`,
                { userIds: selectedMembers }
            );

            console.log('Tag response:', response.data);
            setSuccess('Members tagged successfully!');
            setSubmitting(false);
            setSelectedMembers([]); // Clear selection after successful tagging

            // Optionally redirect after success
            setTimeout(() => {
                 navigate(`/organizations/${orgId}/events/${eventId}/photos/${photoId}`);
             }, 1500);

        } catch (err: any) {
            console.error('Error tagging members:', err);
            const apiErrorMessage = err.response?.data?.message;
            setError(apiErrorMessage || 'Failed to tag members. Please try again.');
            setSubmitting(false);
        }
    };

    // Handle cancel
    const handleCancel = () => {
        navigate(`/organizations/${orgId}/events/${eventId}/photos/${photoId}`);
    };

    // --- TopBar components ---
    const searchComponent = (
        <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search attendees..."
            className="ms-3"
        />
    );

    const rightComponents = (
        <>
            <div className="d-flex align-items-center gap-3">
                {user && token ? (
                    <>
                        <NavLink to="/account-settings" className="text-light top-bar-element">
                            <icon.GearFill size={24} />
                        </NavLink>
                        <NavLink to="/logout" className="text-light top-bar-element">
                            <icon.BoxArrowRight size={24} />
                        </NavLink>
                    </>
                ) : (
                    <>
                        <NavButton
                            to="/register"
                            variant="outline-light"
                            className="mx-1 top-bar-element"
                        >
                            Register
                        </NavButton>
                        <NavButton to="/login" variant="outline-light" className="top-bar-element">
                            Login
                        </NavButton>
                    </>
                )}
            </div>
        </>
    );
    // --- End TopBar components ---

    return (
        <>
            <Row className="g-0">
                <Col md="auto" className="sidebar-container">
                    <Sidebar />
                </Col>
                <Col className="main-content p-0">
                    <div className="sticky-top bg-dark z-3">
                        <Row>
                            <TopBar
                                searchComponent={searchComponent}
                                rightComponents={rightComponents}
                            />
                        </Row>
                    </div>

                    <div className="photo-tagging-page bg-dark text-light min-vh-100">
                        <Container fluid className="px-4 pt-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h1 className="mb-0">Photos: {eventName}</h1>
                                <NavButton
                                    to={`/organizations/${orgId}/events/${eventId}/photos/${photoId}`}
                                    variant="outline-light"
                                >
                                    <icon.X size={24} className="me-2" />
                                    Close
                                </NavButton>
                            </div>

                            <h2 className="fs-3 mb-4 text-center">
                                Select the members that you want to tag
                            </h2>

                            {/* Error and Success Alerts */}
                            {error && (
                                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                                    {error}
                                </Alert>
                            )}

                            {success && (
                                <Alert
                                    variant="success"
                                    dismissible
                                    onClose={() => setSuccess(null)}
                                >
                                    {success}
                                </Alert>
                            )}

                            <h3 className="mb-3">Members who attended:</h3>

                            {loading ? (
                                <div className="text-center p-5">
                                    <Spinner animation="border" variant="light" />
                                    <p className="mt-3">Loading event attendees...</p>
                                </div>
                            ) : filteredAttendees.length === 0 ? (
                                <div className="text-center p-5">
                                    {searchTerm
                                        ? 'No matching members found.'
                                        : 'No members attended this event or details could not be loaded.'}
                                </div>
                            ) : (
                                <>
                                    {/* Display members in a card grid layout */}
                                    <Row className="g-4 member-cards-container mb-4">
                                        {visibleAttendees.map((attendee: AttendeeForTagging) => (
                                            <Col
                                                xs={12}
                                                sm={6}
                                                md={4}
                                                lg={3}
                                                key={attendee.userId}
                                                className="d-flex justify-content-center"
                                            >
                                                {/* Pass necessary props, handle loading/missing details */}
                                                <MemberCard
                                                   // Cast to the expected Member type for the card, handling potentially null userDetails
                                                   member={{
                                                        ...attendee,
                                                        // Provide default userDetails if null or loading, or handle inside MemberCard
                                                        userDetails: attendee.userDetails || {
                                                            id: attendee.userId,
                                                            email: `${attendee.userId}@unknown.com`,
                                                            firstName: attendee.isLoadingDetails ? 'Loading...' : 'Attendee',
                                                            lastName: attendee.isLoadingDetails ? '' : 'User',
                                                        },
                                                        // Ensure other required Member fields are present, even if defaults
                                                        role: attendee.role || 'MEMBER',
                                                        joinDate: attendee.joinDate || new Date().toISOString(),
                                                    }}
                                                    isSelected={selectedMembers.includes(
                                                        attendee.userId
                                                    )}
                                                    // Disable selection if details are still loading or failed
                                                    onSelect={attendee.userDetails && !attendee.isLoadingDetails ? handleMemberSelect : () => {}}
                                                />
                                            </Col>
                                        ))}
                                    </Row>

                                    {/* Load More Button */}
                                    {!searchTerm && hasMore && (
                                        <div className="text-center mt-4 mb-5">
                                            <Button
                                                variant="primary"
                                                onClick={handleLoadMore}
                                                disabled={loadingMore}
                                                className="load-more-button"
                                            >
                                                {loadingMore ? (
                                                    <>
                                                        <Spinner
                                                            as="span"
                                                            animation="border"
                                                            size="sm"
                                                            role="status"
                                                            aria-hidden="true"
                                                            className="me-2"
                                                        />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    'Load More'
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Action Buttons */}
                            <div className="action-buttons-container d-flex justify-content-between my-4">
                                <Button
                                    variant="secondary"
                                    onClick={handleCancel}
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>

                                <Button
                                    variant="secondary"
                                    onClick={handleSubmitTags}
                                    disabled={selectedMembers.length === 0 || submitting || loading} // Disable if loading attendees too
                                >
                                    {submitting ? (
                                        <>
                                            <Spinner
                                                as="span"
                                                animation="border"
                                                size="sm"
                                                role="status"
                                                aria-hidden="true"
                                                className="me-2"
                                            />
                                            Tagging...
                                        </>
                                    ) : (
                                        `Tag selected members (${selectedMembers.length})`
                                    )}
                                </Button>
                            </div>
                        </Container>
                    </div>
                </Col>
            </Row>
        </>
    );
};

export default PhotoTaggingPage;