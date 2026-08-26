import { db } from '@/lib/db';

/**
 * Middleware factory to enforce granular permission scopes on API endpoints.
 */
export function requireScope(requiredScope) {
  return async function (req, res, next) {
    try {
      const userId = req.user?.id;
      const clubId = req.headers['x-club-id'] || req.body?.club_id;

      if (!userId || !clubId) {
        return res.status(401).json({ error: 'Unauthorized: Missing user session or club context.' });
      }

      // Query user's assigned role permissions for the given club
      const roleQuery = await db.query(
        `SELECT cr.permissions 
         FROM club_memberships cm 
         JOIN club_roles cr ON cm.role_id = cr.id 
         WHERE cm.user_id = $1 AND cm.club_id = $2`,
        [userId, clubId]
      );

      if (roleQuery.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: No membership found for this club.' });
      }

      const permissions = roleQuery.rows[0].permissions || [];

      // Check if user has the required scope (or wildcard '*' admin permission)
      if (!permissions.includes(requiredScope) && !permissions.includes('*')) {
        return res.status(403).json({ 
          error: `Forbidden: Insufficient permissions. Required scope: '${requiredScope}'.` 
        });
      }

      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      return res.status(500).json({ error: 'Internal server error during authorization check.' });
    }
  };
}
