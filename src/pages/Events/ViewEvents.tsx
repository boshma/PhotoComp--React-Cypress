/* src/pages/Events/ViewEvents.tsx */
import React, { useState, useEffect, useRef, useContext } from 'react';
import { Button, Col, Row, Container, Alert } from 'react-bootstrap'; // Added Container and Alert
import * as icon from 'react-bootstrap-icons';
import { NavLink, useParams } from 'react-router-dom';

import Sidebar from '../../components/bars/SideBar/SideBar';
import TopBar from '../../components/bars/TopBar/TopBar';
import SearchBar from '../../components/bars/SearchBar/SearchBar';
import NavButton from '../../components/navButton/NavButton';
import GalleryCard from '../../components/cards/galleryCard/GalleryCard';
import {
    Organization,
    Event,
    getPublicOrganizations,
    getPublicOrganizationEvents,
    OrganizationsResponse,
} from '../../context/OrgService';
import AuthContext from '../../context/AuthContext';

const Events: React.FC = () => {
    const { user, token } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [organizations, setOrganizations] = useState<Organization[]>([]); // Keep track of orgs
    const [lastEvaluatedKeyOrg, setLastEvaluatedKeyOrg] = useState<string | null>(null);
    const [events, setEvents] = useState<Event[]>([]); // Master list of all fetched events
    const [filteredEvents, setFilteredEvents] = useState<Event[]>([]); // Filtered list for display
    const [lastEvaluatedKeyOrgEvent, setLastEvaluatedKeyOrgEvent] = useState<
        Record<string, string | null>
    >({});
    const [loading, setLoading] = useState<boolean>(true); // Combined loading state
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const fetchedRef = useRef(false);
    const { id } = useParams<{ id: string }>();

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    /* Components to be injected into the TopBar*/
    const searchComponent = (
        <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search events by name or description..." // Updated placeholder
            className="ms-3"
        />
    );

    /* Components to be injected into the TopBar*/
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

    const pageActionComponents = (
        <>
            <div className="d-flex align-items-center gap-3">
                {/* Placeholder for potential future actions */}
            </div>
        </>
    );

    // Fetches organizations (needed to iterate and get events)
    const fetchOrganizations = async (
        key: string | undefined = undefined
    ): Promise<OrganizationsResponse | null> => {
        setLoading(true); // Start loading when fetching orgs
        try {
            const orgsResponse = await getPublicOrganizations(key);
            const newOrgs = orgsResponse.data.organizations;

            if (key) {
                // Append new orgs if loading more
                setOrganizations(prev => {
                    const existingIds = new Set(prev.map(org => org.id));
                    const uniqueNewOrgs = newOrgs.filter(org => !existingIds.has(org.id));
                    return [...prev, ...uniqueNewOrgs];
                });
            } else {
                // Initial fetch, set the orgs
                setOrganizations(newOrgs);
            }

            setLastEvaluatedKeyOrg(orgsResponse.lastEvaluatedKey);
            return orgsResponse; // Return the response to chain fetches
        } catch (err) {
            setError('Failed to fetch organizations');
            setLoading(false); // Stop loading on error
            return null;
        }
    };

    // Fetches events for a given list of organizations
    const fetchEventsForOrganizations = async (orgs: Organization[], isInitialFetch: boolean) => {
        const eventPromises = orgs.map(async org => {
            const key = lastEvaluatedKeyOrgEvent[org.id];
            // Skip fetching if we already know there are no more events for this org
            if (!isInitialFetch && key === null) {
                return { orgId: org.id, events: [], lastKey: null };
            }
            try {
                // Use org.name as the identifier for fetching events
                const res = await getPublicOrganizationEvents(org.name, key ?? undefined);
                return { orgId: org.id, events: res.data.events, lastKey: res.lastEvaluatedKey ?? null };
            } catch (err) {
                console.error(`Failed to fetch events for org ${org.name}:`, err);
                return { orgId: org.id, events: [], lastKey: null }; // Return empty on error for this org
            }
        });

        const results = await Promise.all(eventPromises);
        const allNewEvents: Event[] = [];
        const newEventKeys: Record<string, string | null> = {};

        results.forEach(result => {
            allNewEvents.push(...result.events);
            newEventKeys[result.orgId] = result.lastKey;
        });

        // Append new events, avoiding duplicates
        setEvents(prev => {
            const existingEventIds = new Set(prev.map(event => event.id));
            const uniqueNewEvents = allNewEvents.filter(event => !existingEventIds.has(event.id));
            return [...prev, ...uniqueNewEvents];
        });

        // Update the keys for each organization
        setLastEvaluatedKeyOrgEvent(prev => ({ ...prev, ...newEventKeys }));

        // Determine if there are more events to load (across all orgs)
        const anyOrgHasMore = Object.values(newEventKeys).some(key => key !== null);
        return anyOrgHasMore;
    };

    // Initial data fetch effect
    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const initialize = async () => {
            setLoading(true);
            const orgResponse = await fetchOrganizations(); // Fetch initial orgs
            if (orgResponse?.data?.organizations) {
                const orgs = orgResponse.data.organizations;
                if (orgs.length > 0) {
                    const anyOrgHasMoreEvents = await fetchEventsForOrganizations(orgs, true);
                    setHasMore(orgResponse.lastEvaluatedKey !== null || anyOrgHasMoreEvents);
                } else {
                    setHasMore(false); // No orgs, so no more data
                }
            } else {
                setHasMore(false); // Error fetching orgs or no orgs
            }
            setLoading(false);
        };

        initialize();
    }, []); // Run only once on mount

    // Filter events based on search term
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredEvents(events);
        } else {
            const searchLower = searchTerm.toLowerCase();
            const filtered = events.filter(event => {
                const titleMatch = event.title.toLowerCase().includes(searchLower);
                const descMatch = event.description?.toLowerCase().includes(searchLower) || false;
                return titleMatch || descMatch;
            });
            setFilteredEvents(filtered);
        }
    }, [events, searchTerm]);

    // Handle loading more data
    const loadMore = async () => {
        if (loading || !hasMore) return; // Don't load if already loading or no more data
        setLoading(true);

        // Check if any current organization has more events to fetch
        let orgsWithMoreEvents = organizations.filter(org => lastEvaluatedKeyOrgEvent[org.id] !== null);

        let moreEventsFetched = false;
        if (orgsWithMoreEvents.length > 0) {
            moreEventsFetched = await fetchEventsForOrganizations(orgsWithMoreEvents, false);
        }

        // If no more events from current orgs AND there are more orgs to fetch
        let moreOrgsFetched = false;
        if (!moreEventsFetched && lastEvaluatedKeyOrg !== null) {
            const orgResponse = await fetchOrganizations(lastEvaluatedKeyOrg);
            if (orgResponse?.data?.organizations && orgResponse.data.organizations.length > 0) {
                moreOrgsFetched = true;
                // Fetch events for the newly loaded organizations
                moreEventsFetched = await fetchEventsForOrganizations(orgResponse.data.organizations, true);
            }
        }

        // Update hasMore state
        const stillHasMoreEvents = Object.values(lastEvaluatedKeyOrgEvent).some(key => key !== null);
        setHasMore(stillHasMoreEvents || lastEvaluatedKeyOrg !== null);

        setLoading(false);
    };

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
                    <div className="p-3 bg-dark text-white min-vh-100"> {/* Ensure min-vh-100 */}
                        <Container fluid>
                            <Row className="align-items-center mb-4">
                                <Col>
                                    <h1 className="mb-0">Events</h1> {/* Reduced margin */}
                                </Col>
                                <Col xs="auto" className="ms-auto me-5">
                                    {pageActionComponents}
                                </Col>
                            </Row>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Row className="g-4"> {/* Use g-4 for consistent gap */}
                                {loading && events.length === 0 ? (
                                    <div className="text-center p-5">Loading events...</div>
                                ) : filteredEvents.length === 0 ? (
                                    <div className="text-center p-5">
                                        {searchTerm
                                            ? 'No events found matching your search.'
                                            : 'No events found.'}
                                    </div>
                                ) : (
                                    filteredEvents.map(event => (
                                        <Col key={event.id} xs={12} sm={6} md={4} lg={3}> {/* Responsive grid */}
                                            <GalleryCard
                                                item={event}
                                                className={`event-card`}
                                                orgName={event.GSI2PK} // Pass organization identifier
                                            />
                                        </Col>
                                    ))
                                )}
                            </Row>
                            {hasMore && events.length > 0 && !searchTerm && ( // Show Load More only if not searching
                                <Row className="mt-4">
                                    <Col className="text-center">
                                        <Button
                                            onClick={loadMore}
                                            disabled={loading}
                                            variant="primary"
                                        >
                                            {loading ? 'Loading...' : 'Load More'}
                                        </Button>
                                    </Col>
                                </Row>
                            )}
                        </Container>
                    </div>
                </Col>
            </Row>
        </>
    );
};

export default Events;