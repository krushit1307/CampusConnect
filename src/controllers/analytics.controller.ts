// =============================================================================
// Controller: Analytics (Heavy Aggregations)
// Issue: #2424 - Implement Read-Replica routing for massive Analytics queries
// Description: Handles the 5-second dashboard aggregation queries.
// Strictly utilizes the replicaClient and routeReadQuery to prevent 
// locking up the Primary database node's CPU and RAM.
// =============================================================================

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { replicaClient, runAnalyticsQuery } from '../lib/prisma/replicaClient';
import { routeReadQuery } from '../lib/prisma/dbRouter';

/**
 * GET /api/analytics/dashboard
 * Fetches massive aggregated stats for the admin dashboard.
 * This query takes 3-5 seconds and would crash the primary node if routed there.
 */
export async function getDashboardAnalytics(req: Request, res: Response) {
    try {
        const { clubId, startDate, endDate } = req.query;

        // Use the analytics wrapper for extended timeouts (15 seconds)
        const stats = await runAnalyticsQuery(async (client: PrismaClient) => {

            // Parallel execution of heavy aggregations using Promise.all
            const [
                totalUsers,
                activeEvents,
                rsvpConversionRate,
                topPerformingClubs
            ] = await Promise.all([

                // 1. Total unique users across all clubs
                client.user.count({
                    where: {
                        createdAt: {
                            gte: startDate ? new Date(startDate as string) : undefined,
                            lte: endDate ? new Date(endDate as string) : undefined,
                        }
                    }
                }),

                // 2. Active events with complex filtering
                client.event.count({
                    where: {
                        status: 'ACTIVE',
                        startDate: { gte: new Date() },
                        clubId: clubId as string | undefined
                    }
                }),

                // 3. RSVP Conversion Rate (Complex aggregation)
                client.eventRsvp.groupBy({
                    by: ['eventId'],
                    _count: { userId: true },
                    where: {
                        checkedIn: true,
                        event: {
                            startDate: {
                                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                            }
                        }
                    }
                }),

                // 4. Top performing clubs by member growth
                client.club.findMany({
                    take: 5,
                    orderBy: { members: { _count: 'desc' } },
                    include: { _count: { select: { members: true } } }
                })
            ]);

            // Calculate conversion rate percentage
            const totalRSVPs = rsvpConversionRate.reduce((sum, rsvp) => sum + rsvp._count.userId, 0);

            return {
                totalUsers,
                activeEvents,
                totalCheckIns: totalRSVPs,
                topClubs: topPerformingClubs.map(club => ({
                    id: club.id,
                    name: club.name,
                    memberCount: club._count.members
                }))
            };
        });

        res.status(200).json({ success: true, data: stats });

    } catch (error: any) {
        console.error('[AnalyticsController] Dashboard query failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard analytics. The replica node may be under heavy load.'
        });
    }
}

/**
 * GET /api/analytics/event/:id
 * Fetches detailed stats for a specific event.
 * Uses the router to handle potential Read-After-Write scenarios.
 */
export async function getEventAnalytics(req: Request, res: Response) {
    try {
        const { id } = req.params;

        // Route through the DB Router. 
        // isHeavyAnalytics = false, so it will check the recentWriteCache.
        // If the event was just updated, it reads from Primary. Otherwise, Replica.
        const eventStats = await routeReadQuery(
            'Event',
            id,
            false, // Not a massive dashboard query, but still read-heavy
            async (client) => {
                return client.event.findUnique({
                    where: { id },
                    include: {
                        rsvps: {
                            select: { checkedIn: true, createdAt: true }
                        },
                        club: {
                            select: { name: true, logoUrl: true }
                        }
                    }
                });
            }
        );

        if (!eventStats) {
            return res.status(404).json({ success: false, error: 'Event not found' });
        }

        // Process the data in memory (CPU is fine here since it's a small dataset)
        const totalRsvps = eventStats.rsvps.length;
        const checkedIn = eventStats.rsvps.filter(r => r.checkedIn).length;

        res.status(200).json({
            success: true,
            data: {
                ...eventStats,
                analytics: {
                    totalRsvps,
                    checkedIn,
                    attendanceRate: totalRsvps > 0 ? (checkedIn / totalRsvps) * 100 : 0
                }
            }
        });

    } catch (error: any) {
        console.error('[AnalyticsController] Event stats failed:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch event analytics' });
    }
}
