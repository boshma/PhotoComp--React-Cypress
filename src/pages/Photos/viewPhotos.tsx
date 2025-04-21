/* src/pages/Photos/viewPhotos.tsx */
import React, { useState, useEffect, useRef, useContext } from 'react';
import { Col, Row, Button, Alert, Container } from 'react-bootstrap'; // Added Container
import * as icon from 'react-bootstrap-icons';
import { NavLink, useParams } from 'react-router-dom';

import Sidebar from '../../components/bars/SideBar/SideBar';
import TopBar from '../../components/bars/TopBar/TopBar';
import SearchBar from '../../components/bars/SearchBar/SearchBar';
import NavButton from '../../components/navButton/NavButton';
import GalleryCard from '../../components/cards/galleryCard/GalleryCard';
import { getAllPhotos, Photo } from '../../context/PhotoService';
import { getPublicOrganizationEvents, Event } from '../../context/OrgService';
import AuthContext from '../../context/AuthContext';
import {
    changeEventPublicity,
    getOrganizationEvents,
} from '../../context/OrgService';
import {
    attendEvent,
    getEventAttendees,
    EventUser,
} from '../../context/EventService';
import { UserOrgRelationship, isMemberOfOrg } from '../../context/AuthService';

const Photos: React.FC = () => {
    const { user, token } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]); // State for filtered photos
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [eventInfo, setEventInfo] = useState<Event | null>(null);
    const [loadingEvent, setLoadingEvent] = useState<boolean>(true);
    const [isAdminUser, setIsAdminUser] = useState(false);
    const [isMember, setIsMember] = useState<UserOrgRelationship | null>(null);
    const [isEventAttendee, setIsEventAttendee] = useState<EventUser | null>(null);
    const [eventPublicity, setEventPublicity] = useState<boolean | null>(null);
    const fetchedRef = useRef(false);
    const { id, eid } = useParams();

    // Fetch event details
    const fetchEventDetails = async () => {
        if (id) {
            try {
                setLoadingEvent(true);
                const response = await getPublicOrganizationEvents(id);
                const event = response.data.events.find(e => e.id === eid);

                if (event) {
                    setEventInfo(event);
                }

                setLoadingEvent(false);
            } catch (err) {
                console.error('Error fetching event details:', err);
                setLoadingEvent(false);
            }
        }
    };

    // Fetch photos
    const fetchPhotos = async () => {
        if (id && eid) {
            setLoading(true);
            try {
                const photosResponse = await getAllPhotos(id, eid);
                // console.log('Fetched photos:', photosResponse.data.photos); // Debugging
                setPhotos(photosResponse.data.photos || []);
                setFilteredPhotos(photosResponse.data.photos || []); // Initialize filtered list
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch photos.');
                setLoading(false);
            }
        } else {
            setError('Org name or EventId is empty.');
            setLoading(false);
        }
    };

    // Fetch user role in the organization
    const fetchUserRole = async (): Promise<UserOrgRelationship | undefined> => {
        if (id && user) {
            try {
                const member = await isMemberOfOrg(user.id, id);
                setIsMember(member.data.data.membership);
                return member.data.data.membership;
            } catch (error) {
                console.error(`Error fetching the member ${id}:`, error);
                // If user is not a member, isMemberOfOrg will throw an error (e.g., 404)
                setIsMember(null);
                // No need to re-throw, just handle the null state
            }
        }
        return undefined;
    };

    // Check if the user is an admin
    const checkIfAdmin = async () => {
        try {
            if (!id || !user) {
                setIsAdminUser(false);
                return;
            }
            const result = await fetchUserRole();
            // console.log(`userRole check result:`, result); // Debugging
            setIsAdminUser(result?.role === 'ADMIN');
        } catch (error) {
            console.error('Error checking admin status:', error);
            setIsAdminUser(false);
        }
    };

    // Fetch event attendees
    const fetchEventAttendees = async () => {
        if (id && eid && user) {
            try {
                const attendees = await getEventAttendees(id, eid);
                if (attendees) {
                    const isAttending = attendees.find(
                        attendee => (attendee as unknown as string) === user.id
                    );
                    // console.log('Is attending check:', isAttending); // Debugging
                    setIsEventAttendee(isAttending ? (isAttending as unknown as EventUser) : null);
                }
            } catch (error) {
                console.error(`Error fetching attendees for event ${eid}:`, error);
            }
        }
    };

    // Fetch event publicity status
    const fetchEventPublicity = async () => {
        if (!id || !eid) return;

        try {
            const response = await getOrganizationEvents(id);
            const event = response.data.events.find(e => e.id === eid);

            if (event && typeof event.isPublic === 'boolean') {
                setEventPublicity(event.isPublic);
            } else {
                console.warn(`Event ${eid} not found or publicity status missing.`);
            }
        } catch (error) {
            console.error(`Error fetching publicity for event ${eid}:`, error);
            // Don't set error state here, just rely on the initial null value
        }
    };

    // Initial data fetching
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([
                fetchEventDetails(),
                fetchPhotos(),
                fetchUserRole(),
                fetchEventPublicity(),
                fetchEventAttendees(),
            ]);
            await checkIfAdmin(); // Check admin status after role is fetched
            setLoading(false);
        };

        fetchData();
    }, [id, eid, user]); // Add user as dependency

    // Filter photos based on search term
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredPhotos(photos);
        } else {
            const filtered = photos.filter(photo => {
                // Search in photo metadata title
                const title = photo.metadata?.title?.toLowerCase() || '';
                const searchLower = searchTerm.toLowerCase();
                return title.includes(searchLower);
            });
            setFilteredPhotos(filtered);
        }
    }, [photos, searchTerm]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    // Toggle event publicity
    const changePublicity = async () => {
        if (id && eid) {
            try {
                const currentPublicity = eventPublicity;
                setEventPublicity(prev => !prev); // Optimistic UI update

                await changeEventPublicity(id, eid);
                // console.log('Event publicity API response received'); // Debugging
            } catch (error) {
                console.error(`Error changing event publicity ${eid}:`, error);
                setEventPublicity(prev => !prev); // Revert UI on error
                setError('Failed to change event publicity');
            }
        }
    };

    // Handle user attending the event
    const handleAttendEvent = async () => {
        if (!id || !eid || !user) return;

        try {
            const response = await attendEvent(id, eid);
            // console.log(`Attend event response:`, response); // Debugging
            if (response?.data?.userEvent) {
                setIsEventAttendee(response.data.userEvent);
            }
        } catch (error) {
            console.error(`Failed to attend event ${eid}:`, error);
            setError('Could not attend the event.');
        }
    };

    /* Components to be injected into the TopBar */
    const searchComponent = (
        <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search Photos by Title..." // Updated placeholder
            className="ms-3"
        />
    );

    const rightComponents = (
        <>
            <div className="d-flex align-items-center gap-3">
                {isAdminUser && (
                    <NavButton
                        to={`/organizations/${id}/events/${eid}/photos/upload`}
                        variant="outline-light"
                        className="mx-1 top-bar-element"
                    >
                        Upload Photos
                    </NavButton>
                )}
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

    const pageActionComponents = (
        <div className="d-flex align-items-center gap-3">
            {!isEventAttendee && isMember && (
                <Button
                    onClick={handleAttendEvent}
                    className="top-bar-element custom-create-button"
                >
                    Attend Event
                </Button>
            )}

            {user && token && eventPublicity !== null && (
                isAdminUser ? (
                    <Button
                        onClick={changePublicity}
                        className="icon-only-button"
                        title={eventPublicity ? 'Make Private' : 'Make Public'}
                    >
                        {eventPublicity ? (
                            <icon.UnlockFill size={20} />
                        ) : (
                            <icon.LockFill size={20} />
                        )}
                    </Button>
                ) : (
                    <span title={eventPublicity ? 'Event is Public' : 'Event is Private'}>
                        {eventPublicity ? (
                            <icon.UnlockFill size={24} />
                        ) : (
                            <icon.LockFill size={24} />
                        )}
                    </span>
                )
            )}

            <NavLink to={`/organizations/${id}/events/${eid}/details`} className="icon-only-button">
                <icon.ListUl size={24} />
            </NavLink>
        </div>
    );

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
                    <div className="p-3 bg-dark text-white min-vh-100">
                        <Container fluid>
                            <Row className="align-items-center mb-4">
                                <Col>
                                    <h1 className="mb-0">
                                        Photos:
                                        {loadingEvent ? (
                                            ' Loading...'
                                        ) : (
                                            eventInfo?.title && <span> {eventInfo.title}</span>
                                        )}
                                    </h1>
                                </Col>
                                <Col xs="auto" className="ms-auto me-5">
                                    {pageActionComponents}
                                </Col>
                            </Row>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Row className="g-4">
                                {loading ? (
                                    <div className="text-center p-5">Loading photos...</div>
                                ) : filteredPhotos.length === 0 ? (
                                    <div className="text-center p-5">
                                        {searchTerm
                                            ? 'No matching photos found for your search.'
                                            : 'No photos available for this event.'}
                                    </div>
                                ) : (
                                    filteredPhotos.map(photo => (
                                        <Col key={photo.id} xs={12} sm={6} md={4} lg={3}>
                                            <GalleryCard
                                                item={photo}
                                                className={`photo-card`}
                                                orgName={id} // Pass orgId as orgName
                                            />
                                        </Col>
                                    ))
                                )}
                            </Row>
                        </Container>
                    </div>
                </Col>
            </Row>
        </>
    );
};

export default Photos;