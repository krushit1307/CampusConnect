import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import Timeline, { TimelineMilestone } from '../components/clubs/Timeline';
import { supabase } from '../lib/supabase';
import { Loader2, History, AlertCircle } from 'lucide-react';

/**
 * Mock data structure for club history milestones.
 * In a production environment, this would be fetched from the Supabase `club_milestones` table.
 * We include a comprehensive dataset here to demonstrate the fluid scrolling
 * and IntersectionObserver capabilities of the Timeline component across
 * many different years and event types.
 */
const MOCK_MILESTONES: TimelineMilestone[] = [
    {
        id: 'ms-001',
        year: 2015,
        title: 'The Inception',
        description: 'Founded by a small group of passionate students in the basement of the engineering building. Our initial mission was simply to create a safe space for tech enthusiasts to share ideas and collaborate on weekend projects.',
        icon: 'rocket',
    },
    {
        id: 'ms-002',
        year: 2016,
        title: 'First Major Hackathon',
        description: 'Hosted our inaugural 24-hour hackathon, "CodeFest 1.0", attracting over 150 participants from three different neighboring colleges. The winning team built a revolutionary campus navigation app that is still used today.',
        icon: 'zap',
        imageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 'ms-003',
        year: 2017,
        title: 'Official University Recognition',
        description: 'After a year of relentless advocacy, the Student Council officially recognized us as a premier technical society, granting us dedicated office space and an annual budget for equipment and guest lectures.',
        icon: 'award',
    },
    {
        id: 'ms-004',
        year: 2018,
        title: 'National Championship Victory',
        description: 'Our robotics team secured first place at the National University Robotics Championship, defeating 45 other top-tier institutions. This victory put our club on the national map and attracted significant industry sponsorships.',
        icon: 'award',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 'ms-005',
        year: 2019,
        title: 'Community Outreach Program',
        description: 'Launched the "Tech for All" initiative, partnering with local high schools to teach basic programming and web development to over 500 underprivileged students, bridging the digital divide in our local community.',
        icon: 'users',
    },
    {
        id: 'ms-006',
        year: 2020,
        title: 'The Virtual Pivot',
        description: 'When the world shut down, we didn\'t stop. We transitioned all our workshops, meetups, and mentorship programs to a fully virtual format, maintaining a 95% member retention rate and hosting weekly global tech talks.',
        icon: 'rocket',
    },
    {
        id: 'ms-007',
        year: 2021,
        title: 'Open Source Milestone',
        description: 'Released our internal club management platform as an open-source project. It gained over 2,000 GitHub stars in the first month and is now used by dozens of other university clubs worldwide to manage their events and members.',
        icon: 'star',
        imageUrl: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=800&q=80',
    },
    {
        id: 'ms-008',
        year: 2022,
        title: 'Industry Partnership Expansion',
        description: 'Signed strategic partnership agreements with five Fortune 500 tech companies, providing our members with exclusive internship pipelines, sponsored project grants, and direct access to industry mentors.',
        icon: 'users',
    },
    {
        id: 'ms-009',
        year: 2023,
        title: 'AI & Machine Learning Wing',
        description: 'Established a dedicated AI research wing within the club, securing a $50,000 grant to purchase high-performance GPU clusters. Our members published three papers in top-tier undergraduate AI conferences.',
        icon: 'zap',
    },
    {
        id: 'ms-010',
        year: 2024,
        title: 'Record Breaking Membership',
        description: 'Crossed the 1,000 active member mark, making us the largest technical society in the university\'s history. We expanded our operations to include dedicated sub-teams for Web3, Cybersecurity, and Cloud Computing.',
        icon: 'users',
        imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
    },
];

/**
 * ClubHistory Page Component
 * 
 * This page serves as the dedicated space for showcasing a club's legacy,
 * achievements, and historical milestones. It integrates the fluid horizontal
 * scrolling Timeline component to provide a visually engaging and interactive
 * experience for prospective and current members.
 * 
 * The page handles data fetching states, error boundaries, and ensures
 * proper SEO metadata is applied via react-helmet-async.
 */
const ClubHistory: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [milestones, setMilestones] = useState<TimelineMilestone[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [clubName, setClubName] = useState<string>('Our Club');

    /**
     * Fetches the club details and historical milestones from the database.
     * Currently falls back to mock data if the specific database tables
     * are not yet provisioned or if the query fails.
     */
    useEffect(() => {
        const fetchClubHistory = async () => {
            if (!slug) return;

            try {
                setLoading(true);
                setError(null);

                // Fetch basic club info for the header
                const { data: clubData, error: clubError } = await supabase
                    .from('clubs')
                    .select('name')
                    .eq('slug', slug)
                    .single();

                if (clubError) throw clubError;
                if (clubData) setClubName(clubData.name);

                // Fetch milestones (Fallback to mock data if table doesn't exist yet)
                const { data: milestonesData, error: milestonesError } = await supabase
                    .from('club_milestones')
                    .select('*')
                    .eq('club_slug', slug)
                    .order('year', { ascending: true });

                if (milestonesError) {
                    // If the table doesn't exist, gracefully fallback to mock data
                    console.warn('Milestones table not found, using mock data:', milestonesError.message);
                    setMilestones(MOCK_MILESTONES);
                } else if (milestonesData && milestonesData.length > 0) {
                    setMilestones(milestonesData);
                } else {
                    // No data found, use mock data for demonstration
                    setMilestones(MOCK_MILESTONES);
                }

            } catch (err: any) {
                console.error('Error fetching club history:', err);
                setError('Failed to load club history. Please try again later.');
                // Fallback to mock data on critical failure so the page isn't empty
                setMilestones(MOCK_MILESTONES);
            } finally {
                setLoading(false);
            }
        };

        fetchClubHistory();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950">
                <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <p className="mt-4 text-gray-600 dark:text-gray-400 text-lg">Loading club history...</p>
            </div>
        );
    }

    return (
        <>
            <Helmet>
                <title>{`History | ${clubName} | CampusConnect`}</title>
                <meta name="description" content={`Explore the rich history and major milestones of ${clubName}. From our founding to our latest achievements, discover our journey.`} />
            </Helmet>

            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Page Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-16"
                    >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 mb-6">
                            <History className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            The <span className="text-indigo-600 dark:text-indigo-400">{clubName}</span> Legacy
                        </h1>
                        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-400">
                            Swipe or scroll horizontally to journey through our defining moments,
                            major victories, and the milestones that shaped our community.
                        </p>
                    </motion.div>

                    {/* Error Banner (if applicable but data is still shown) */}
                    {error && (
                        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3 max-w-3xl mx-auto">
                            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    Showing demonstration data
                                </p>
                                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                    {error} We are displaying our standard milestone template while we sync the live database.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Interactive Timeline Component */}
                    <div className="mt-12">
                        <Timeline milestones={milestones} />
                    </div>

                    {/* Footer Call to Action */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-24 text-center"
                    >
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Be Part of Our Next Chapter
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
                            Our history is built by students like you. Join us today and help write the next milestone in our legacy.
                        </p>
                        <a
                            href={`/clubs/${slug}/join`}
                            className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors duration-200"
                        >
                            Join the Club
                        </a>
                    </motion.div>
                </div>
            </div>
        </>
    );
};

export default ClubHistory;
