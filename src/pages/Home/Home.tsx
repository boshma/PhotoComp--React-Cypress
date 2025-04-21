/* src/pages/Home/Home.tsx */
import React, { useState, useEffect, useContext } from 'react';
import AuthContext from '../../context/AuthContext';
import { Col, Row, Button, Container } from 'react-bootstrap';
import * as icon from 'react-bootstrap-icons';
import Sidebar from '../../components/bars/SideBar/SideBar';
import TopBar from '../../components/bars/TopBar/TopBar';
import SearchBar from '../../components/bars/SearchBar/SearchBar';
import NavButton from '../../components/navButton/NavButton';
import { NavLink } from 'react-router-dom';
import OrganizationRow from '../../components/organizationRow/OrganizationRow';
import { Organization, getPublicOrganizations } from '../../context/OrgService';

const Home = () => {
    const { user, token } = useContext(AuthContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([]); // State for filtered orgs
    const [displayCount, setDisplayCount] = useState<number>(3); // Start with 3 rows
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState<string | null>(null);
    const [allOrganizationsLoaded, setAllOrganizationsLoaded] = useState<boolean>(false);

    const fetchOrganizations = async (key: string | undefined = undefined) => {
        try {
            setLoading(true);
            const response = await getPublicOrganizations(key);
            if (key) {
                // Append new organizations to the existing list
                setOrganizations(prev => {
                    const existingIds = new Set(prev.map(org => org.id));
                    const newOrgs = response.data.organizations.filter(org => !existingIds.has(org.id));
                    return [...prev, ...newOrgs];
                });
            } else {
                // Initial fetch, replace the list
                setOrganizations(response.data.organizations);
            }
            setLastEvaluatedKey(response.lastEvaluatedKey);
            setAllOrganizationsLoaded(response.lastEvaluatedKey === null);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching organizations:', err);
            setError('Failed to load organizations. Please try again later.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizations();

        const refreshInterval = setInterval(
            () => {
                // console.log('Refreshing organization data...'); // Debugging
                // Re-fetch from the beginning to update URLs
                fetchOrganizations();
            },
            45 * 60 * 1000
        );

        return () => clearInterval(refreshInterval);
    }, []);

    // Apply search filter whenever organizations or searchTerm changes
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredOrganizations(organizations);
        } else {
            const filtered = organizations.filter(org =>
                org.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredOrganizations(filtered);
        }
        // Reset display count when search term changes
        setDisplayCount(3);
    }, [organizations, searchTerm]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
    };

    const handleLoadMore = () => {
        // If we have more orgs locally to display from the filtered list
        if (displayCount < filteredOrganizations.length) {
            setDisplayCount(prev => prev + 3);
        }
        // If we've displayed all filtered orgs but there might be more to fetch
        else if (!allOrganizationsLoaded && searchTerm.trim() === '') {
            fetchOrganizations(lastEvaluatedKey ?? undefined);
        }
    };

    const searchComponent = (
        <SearchBar
            value={searchTerm}
            onChange={handleSearchChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search organizations by name..." // Updated placeholder
            className="ms-2"
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

    // Use filteredOrganizations for display and pagination logic
    const displayedOrganizations = filteredOrganizations.slice(0, displayCount);
    const canLoadMore = displayCount < filteredOrganizations.length || (!allOrganizationsLoaded && searchTerm.trim() === '');

    return (
        <>
            <Row className="g-0">
                <Col md="auto" className="sidebar-container">
                    <Sidebar />
                </Col>
                <Col className="main-content p-0">
                    <div className="sticky-top bg-dark z-3"> {/* Ensure TopBar is sticky */}
                        <TopBar searchComponent={searchComponent} rightComponents={rightComponents} />
                    </div>
                    <Container fluid className="px-4 py-3 bg-dark text-white min-vh-100"> {/* Ensure content area has dark background and min height */}
                        <h1 className="mb-4 page-title">Organizations & Events</h1>
                        {loading && organizations.length === 0 ? (
                            <div className="text-center p-5">Loading organizations...</div>
                        ) : error ? (
                            <div className="alert alert-danger">{error}</div>
                        ) : filteredOrganizations.length === 0 ? (
                            <div className="text-center p-5">
                                {searchTerm ? 'No organizations found matching your search.' : 'No organizations found.'}
                            </div>
                        ) : (
                            <>
                                {/* Organization Rows */}
                                {displayedOrganizations.map(org => (
                                    <OrganizationRow key={org.id} organization={org} />
                                ))}
                                {/* Load More Button */}
                                {canLoadMore && (
                                    <div className="text-center mt-4 mb-4">
                                        <Button
                                            variant="primary"
                                            onClick={handleLoadMore}
                                            disabled={loading}
                                        >
                                            {loading ? 'Loading...' : 'Load More'}
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </Container>
                </Col>
            </Row>
        </>
    );
};

export default Home;