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
import MemberCard from '../../components/cards/memberCard/MemberCard'; // Import MemberCard
import axiosInstance from '../../utils/axios';
// Import the new function and types
import { getEventDetailsWithAttendees, AttendeeWithDetailsResponse, EventUser } from '../../context/EventService'; // Use AttendeeWithDetailsResponse
import { UserDetails } from '../../components/cards/memberCard/MemberCard'; // Ensure UserDetails is imported

// Use AttendeeWithDetailsResponse directly or create a simple alias if needed
type AttendeeForTagging = AttendeeWithDetailsResponse;

const PhotoTaggingPage: React.FC = () => {
    const navigate = useNavigate();
    const { id: orgId, eid: eventId, photoId } = useParams();
    const { user, token } = useContext(AuthContext);

    // State for search and members
    const [searchTerm, setSearchTerm] = useState('');
    const [attendees, setAttendees] = useState<AttendeeForTagging[]>([]); // Use the updated type
    const [filteredAttendees, setFilteredAttendees] = useState<AttendeeForTagging[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [eventName, setEventName] = useState<string>('');

    // Pagination state
    const [initialDisplayCount] = useState<number>(12);
    const [displayCount, setDisplayCount] = useState<number>(12);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);

    // Fetch initial list of attendees WITH details
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
                // Fetch event details AND attendees with user details in one call
                const response = await getEventDetailsWithAttendees(orgId, eventId);

                setEventName(response.data?.event?.title || 'Event'); // Set event name

                const fetchedAttendees = response.data.attendees || [];

                 // Filter out attendees without userDetails before setting state
                const validAttendees = fetchedAttendees.filter(att => att.userDetails !== null);

                setAttendees(validAttendees as AttendeeForTagging[]); // Cast as AttendeeForTagging
                setFilteredAttendees(validAttendees as AttendeeForTagging[]); // Set filtered list initially
                setDisplayCount(Math.min(validAttendees.length, initialDisplayCount));
                setHasMore(validAttendees.length > initialDisplayCount);
                setLoading(false);

            } catch (err) {
                console.error('Error fetching attendees with details:', err);
                setError('Failed to load event attendees. Please try again later.');
                setAttendees([]);
                setFilteredAttendees([]);
                setHasMore(false);
                setLoading(false);
            }
        };

        fetchInitialAttendees();
    }, [orgId, eventId, photoId, initialDisplayCount]);

     // Filter attendees based on search term
    useEffect(() => {
        const applyFilter = () => {
            let filtered = attendees;

            if (searchTerm.trim() !== '') {
                const searchLower = searchTerm.toLowerCase();
                filtered = attendees.filter((attendee: AttendeeForTagging) => {
                    // Search by name/email if details are loaded
                    if (attendee.userDetails) {
                        const { firstName, lastName, email } = attendee.userDetails;
                        const fullName = `${firstName} ${lastName}`.toLowerCase();
                        return fullName.includes(searchLower) || email.toLowerCase().includes(searchLower);
                    }
                    // Fallback if userDetails somehow missing (shouldn't happen with filter above)
                    return attendee.attendeeInfo.PK.toLowerCase().includes(searchLower);
                });
            }

            setFilteredAttendees(filtered);
            // Adjust display count and hasMore based on the *filtered* list
            setDisplayCount(Math.min(filtered.length, initialDisplayCount));
            setHasMore(filtered.length > initialDisplayCount);
        };

        applyFilter();
    }, [attendees, searchTerm, initialDisplayCount]);

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


    // Handle member selection - Use userDetails.id
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
            setSuccess(null);

            // API call remains the same, sending selected user IDs
            const response = await axiosInstance.post(
                `/organizations/${orgId}/events/${eventId}/photos/${photoId}/tags`,
                { userIds: selectedMembers }
            );

            console.log('Tag response:', response.data);
            setSuccess('Members tagged successfully!');
            setSubmitting(false);
            setSelectedMembers([]); // Clear selection

            // Redirect after success
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
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setDisplayCount(initialDisplayCount); // Reset pagination on new search
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

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
                                        : 'No members attended this event.'}
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
                                                key={attendee.userDetails?.id || attendee.attendeeInfo.PK} // Use userDetails.id if available
                                                className="d-flex justify-content-center"
                                            >
                                                 {/* Ensure userDetails exist before rendering */}
                                                {attendee.userDetails ? (
                                                     <MemberCard
                                                        member={{ // Construct the Member object needed by the card
                                                             PK: attendee.attendeeInfo.PK,
                                                             SK: attendee.attendeeInfo.SK,
                                                             userId: attendee.userDetails.id, // Use ID from details
                                                             role: attendee.attendeeInfo.role || 'MEMBER', // Role comes from attendeeInfo or default
                                                             joinDate: attendee.attendeeInfo.joinDate || new Date().toISOString(), // Use joinDate if available, else fallback
                                                             organizationName: orgId || 'Unknown Org', // Use orgId from params
                                                             userDetails: attendee.userDetails, // Pass the fetched details
                                                         }}
                                                         isSelected={selectedMembers.includes(attendee.userDetails.id)} // Use userDetails.id for selection
                                                         onSelect={() => handleMemberSelect(attendee.userDetails!.id)} // Use userDetails.id for selection handler
                                                     />
                                                 ) : (
                                                      // Should not happen often due to filter, but handle just in case
                                                     <div className="member-card placeholder-card text-center p-3">
                                                         <Spinner animation="border" size="sm" variant="light" className="mb-2" />
                                                         <small>Loading details...</small>
                                                     </div>
                                                 )}

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
                                                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" /> Loading...
                                                    </>
                                                ) : ( 'Load More' )}
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
                                             <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/> Tagging...
                                        </>
                                    ) : ( `Tag selected members (${selectedMembers.length})` )}
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
