// src/components/cards/memberCard/MemberCard.tsx
import React from 'react';
import { Card, Spinner } from 'react-bootstrap'; // Import Spinner

export interface UserDetails {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface Member {
    PK: string; // Primary Key (e.g., USER#userId)
    SK: string; // Sort Key (e.g., ORG#orgName or EVENT#eventId)
    GSI1PK?: string; // Optional GSI attributes
    GSI1SK?: string;
    userId: string; // User's unique ID
    role: string; // User's role in the context (e.g., ADMIN, MEMBER)
    joinDate?: string; // Optional: Date user joined the org/event
    organizationName?: string; // Optional: Name of the organization
    userDetails: UserDetails | null; // User details can be null initially
    isLoadingDetails?: boolean; // Optional flag to indicate loading state
}

interface MemberCardProps {
    member: Member; // Expect the combined Member type
    isSelected: boolean;
    onSelect: (id: string) => void;
    className?: string; // Allow external styling
}

const MemberCard: React.FC<MemberCardProps> = ({ member, isSelected, onSelect, className }) => {
    // Use userId from userDetails if available, otherwise fallback to member.userId
    const memberId = member.userDetails?.id || member.userId;

    const formatDate = (dateString: string | undefined) => {
        // Add validation for dateString
        if (!dateString || isNaN(Date.parse(dateString))) {
            return 'Unknown date'; // Or return an empty string, or some placeholder
        }
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    // Handle potentially null userDetails and loading state
    const displayName = member.isLoadingDetails
        ? 'Loading...'
        : member.userDetails
        ? `${member.userDetails.firstName} ${member.userDetails.lastName}`
        : 'Attendee User'; // Fallback name if details are missing after loading

    const isAdmin = member.role === 'ADMIN';

    const handleCardClick = () => {
        // Only allow selection if details are loaded and valid
        if (member.userDetails && !member.isLoadingDetails) {
            onSelect(memberId);
        }
    };

    return (
        <Card
            className={`member-card ${className || ''} ${isSelected ? 'selected' : ''} ${isAdmin ? 'admin-card' : 'regular-card'} ${member.isLoadingDetails ? 'details-loading' : ''}`}
            onClick={handleCardClick}
            style={{
                width: '300px', // Consistent width
                height: '200px', // Consistent height
                position: 'relative',
                cursor: (member.userDetails && !member.isLoadingDetails) ? 'pointer' : 'default', // Change cursor if not selectable
                backgroundColor: isSelected ? '#4d5154' : '#343a40', // Dark theme background
                borderColor: isSelected ? '#0d6efd' : '#495057', // Use primary blue for selected, gray otherwise
                borderWidth: isSelected ? '2px' : '1px',
                transition: 'all 0.2s ease-in-out',
                opacity: member.isLoadingDetails ? 0.7 : 1, // Dim card while loading details
                color: '#adb5bd', // Lighter text color for readability
            }}
        >
            <div className="card-content text-white p-3 d-flex flex-column justify-content-between h-100"> {/* Adjusted padding */}
                <div>
                     <h5 className="card-title mb-1"> {/* Reduced bottom margin */}
                        {member.isLoadingDetails ? (
                             <Spinner animation="border" size="sm" variant="light" className="me-2" />
                        ) : null}
                        {displayName}
                    </h5>
                     {/* Show email or role if details are available */}
                     {member.userDetails && !member.isLoadingDetails ? (
                         <p className="card-text small text-white-50 mb-1">{member.userDetails.email}</p>
                     ) : !member.isLoadingDetails ? (
                         <p className="card-text small text-danger mb-1">Details unavailable</p> // Indicate if details failed
                     ) : null}
                     <p className={`card-text small ${isAdmin ? 'text-warning' : 'text-white-50'} mb-0`}>{member.role}</p> {/* Highlight admin role */}
                </div>

                <div className="card-footer bg-transparent border-0 text-white-50 mt-auto p-0 text-end"> {/* Align footer text right */}
                     {/* Only show join date if available and not loading */}
                    {member.joinDate && !member.isLoadingDetails && (
                         <small>Member since {formatDate(member.joinDate)}</small>
                     )}
                     {/* Show placeholder if loading */}
                    {member.isLoadingDetails && (
                         <small>Loading details...</small>
                    )}
                 </div>
            </div>
        </Card>
    );
};

export default MemberCard;
