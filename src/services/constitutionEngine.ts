/**
 * Document Constitution Engine
 * Article models, section scroll-spy observers, and text search matchers.
 */

export interface ConstitutionSection {
    id: string;
    articleNumber: string;
    title: string;
    content: string;
}

export const MOCK_CLUB_CONSTITUTION: ConstitutionSection[] = [
    {
        id: "art_1",
        articleNumber: "Article I",
        title: "Name & Official Purpose",
        content: "Section 1. The official name of this organization shall be the Computer Science & AI Student Association of CampusConnect.\nSection 2. The purpose of the association is to foster technical excellence, facilitate open-source development, and promote collaborative learning."
    },
    {
        id: "art_2",
        articleNumber: "Article II",
        title: "Membership Eligibility & Dues",
        content: "Section 1. Membership is open to all enrolled undergraduate and graduate students of the University without discrimination.\nSection 2. Active status requires attendance at 50% of general body meetings per semester."
    },
    {
        id: "art_3",
        articleNumber: "Article III",
        title: "Executive Board Officers & Elections",
        content: "Section 1. Executive Board officers shall consist of President, Vice President, Lead Technical Architect, and Treasurer.\nSection 2. Elections shall be conducted electronically at the end of every Spring academic term via verified student login."
    }
];
