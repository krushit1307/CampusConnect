import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export interface Suspension {
  id: string;
  userId: string;
  reason: string;
  suspendedAt: string;
  suspendedUntil: string;
  remediationCourseId: string | null;
  isActive: boolean;
}

/**
 * Suspend a user account
 */
export async function suspendAccount(
  userId: string,
  reason: string,
  remediationCourseId?: string,
  durationHours: number = 1
): Promise<Suspension> {
  const suspendedUntil = new Date();
  suspendedUntil.setHours(suspendedUntil.getHours() + durationHours);

  const { data, error } = await supabase
    .from('account_suspensions')
    .insert([
      {
        user_id: userId,
        reason,
        suspended_until: suspendedUntil.toISOString(),
        remediation_course_id: remediationCourseId || null,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to suspend account: ${error.message}`);
  }

  // Force logout by invalidating all sessions
  try {
    await invalidateAllSessions(userId);
  } catch (err) {
    console.error('Failed to invalidate sessions:', err);
  }

  return {
    id: data.id,
    userId: data.user_id,
    reason: data.reason,
    suspendedAt: data.suspended_at,
    suspendedUntil: data.suspended_until,
    remediationCourseId: data.remediation_course_id,
    isActive: data.is_active,
  };
}

/**
 * Check if account is suspended
 */
export async function checkIfAccountSuspended(
  userId: string
): Promise<{ isSuspended: boolean; suspension?: Suspension }> {
  const { data, error } = await supabase
    .from('account_suspensions')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('suspended_until', new Date().toISOString())
    .single();

  if (error || !data) {
    return { isSuspended: false };
  }

  return {
    isSuspended: true,
    suspension: {
      id: data.id,
      userId: data.user_id,
      reason: data.reason,
      suspendedAt: data.suspended_at,
      suspendedUntil: data.suspended_until,
      remediationCourseId: data.remediation_course_id,
      isActive: data.is_active,
    },
  };
}

/**
 * Unsuspend account
 */
export async function unsuspendAccount(userId: string): Promise<void> {
  const { error } = await supabase
    .from('account_suspensions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to unsuspend account: ${error.message}`);
  }
}

/**
 * Get active suspensions for user
 */
export async function getActiveSuspensions(userId: string): Promise<Suspension[]> {
  const { data, error } = await supabase
    .from('account_suspensions')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .gt('suspended_until', new Date().toISOString());

  if (error) {
    throw new Error(`Failed to fetch suspensions: ${error.message}`);
  }

  return (data || []).map((s) => ({
    id: s.id,
    userId: s.user_id,
    reason: s.reason,
    suspendedAt: s.suspended_at,
    suspendedUntil: s.suspended_until,
    remediationCourseId: s.remediation_course_id,
    isActive: s.is_active,
  }));
}

/**
 * Invalidate all sessions for a user
 */
async function invalidateAllSessions(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    console.error('Failed to invalidate sessions:', error.message);
  }
}

export default {
  suspendAccount,
  checkIfAccountSuspended,
  unsuspendAccount,
  getActiveSuspensions,
};