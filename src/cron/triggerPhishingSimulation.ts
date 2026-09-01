import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '@/lib/email/service';
import { generatePhishingEmail, selectRandomCampaignType } from '@/lib/security/phishingEmailTemplateService';
import { createRemediationCourse, createRemediationCourse } from '@/lib/security/remediationCourseService';
import { suspendAccount } from '@/lib/security/accountSuspensionService';
import { auditLog } from '@/lib/auditLogger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PHISHING_SIM_ENABLED = process.env.PHISHING_SIM_ENABLED === 'true';
const PHISHING_SIM_DELAY_DAYS = parseInt(process.env.PHISHING_SIM_DELAY_DAYS || '14');
const HONEY_POT_DOMAIN = process.env.HONEY_POT_DOMAIN || 'security-verify.campus.edu';

/**
 * Main cron job function to trigger phishing simulations
 * Run every 6 hours via scheduled job
 */
export async function triggerPhishingSimulation() {
  if (!PHISHING_SIM_ENABLED) {
    console.log('Phishing simulation disabled');
    return;
  }

  try {
    console.log('Starting phishing simulation trigger job');

    // Find admins ready for phishing simulation
    const adminsReady = await findAdminsReadyForPhishing();
    console.log(`Found ${adminsReady.length} admins ready for simulation`);

    // Send phishing campaigns
    for (const admin of adminsReady) {
      try {
        await sendPhishingCampaign(admin);
      } catch (err) {
        console.error(`Failed to send campaign to ${admin.user_id}:`, err);
      }
    }

    console.log('Phishing simulation trigger job completed');
  } catch (err) {
    console.error('Phishing simulation trigger error:', err);
    throw err;
  }
}

/**
 * Find admins promoted 14 days ago who haven't been triggered yet
 */
async function findAdminsReadyForPhishing(): Promise
  Array<{
    id: string;
    user_id: string;
    club_id: string;
    promoted_at: string;
  }>
> {
  const triggerDate = new Date();
  triggerDate.setDate(triggerDate.getDate() - PHISHING_SIM_DELAY_DAYS);

  const { data, error } = await supabase
    .from('admin_promotion_events')
    .select()
    .lte('promoted_at', triggerDate.toISOString())
    .is('phishing_triggered_at', null)
    .limit(100);

  if (error) {
    throw new Error(`Failed to find admins: ${error.message}`);
  }

  return data || [];
}

/**
 * Send phishing campaign to admin
 */
async function sendPhishingCampaign(admin: {
  id: string;
  user_id: string;
  club_id: string;
  promoted_at: string;
}): Promise<void> {
  // Get user email
  const { data: user, error: userError } = await supabase.auth.admin.getUserById(admin.user_id);

  if (userError || !user?.email) {
    throw new Error(`Failed to get user email: ${userError?.message}`);
  }

  // Select random campaign type
  const campaignType = selectRandomCampaignType();

  // Generate honey pot token
  const honeyPotToken = uuidv4();

  // Create honey pot URL
  const honeyPotUrl = `https://${HONEY_POT_DOMAIN}/phishing-test/${honeyPotToken}`;

  // Generate phishing email
  const email = generatePhishingEmail(
    campaignType,
    user.email,
    user.user_metadata?.full_name || 'User',
    honeyPotUrl
  );

  // Create campaign record in database
  const { data: campaign, error: campaignError } = await supabase
    .from('phishing_campaigns')
    .insert([
      {
        admin_promotion_id: admin.id,
        campaign_type: campaignType,
        email_template: email.htmlBody,
        honey_pot_token: honeyPotToken,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (campaignError) {
    throw new Error(`Failed to create campaign: ${campaignError.message}`);
  }

  // Update admin promotion with campaign ID
  await supabase
    .from('admin_promotion_events')
    .update({
      phishing_triggered_at: new Date().toISOString(),
      phishing_campaign_id: campaign.id,
    })
    .eq('id', admin.id);

  // Send phishing email (marked as simulation in metadata)
  try {
    await sendEmail(
      user.email,
      email.subject,
      email.htmlBody,
      email.textBody,
      {
        fromEmail: email.fromEmail,
        fromName: email.fromName,
        isPhishingSimulation: true,
      }
    );

    // Update campaign status to sent
    await supabase
      .from('phishing_campaigns')
      .update({
        sent_at: new Date().toISOString(),
        status: 'sent',
      })
      .eq('id', campaign.id);

    // Audit log
    await auditLog(admin.user_id, 'PHISHING_EMAIL_SENT', {
      campaignId: campaign.id,
      campaignType,
      userEmail: user.email,
    });

    console.log(`Phishing campaign sent to ${user.email}`);
  } catch (err) {
    console.error(`Failed to send email: ${err}`);
    throw err;
  }
}

/**
 * Handle honey pot link clicked
 */
export async function handleHoneyPotClick(token: string, ipAddress: string): Promise<string> {
  // Get campaign from token
  const { data: campaign, error: campaignError } = await supabase
    .from('phishing_campaigns')
    .select('*')
    .eq('honey_pot_token', token)
    .single();

  if (campaignError || !campaign) {
    throw new Error('Invalid honey pot token');
  }

  // Update campaign
  await supabase
    .from('phishing_campaigns')
    .update({
      clicked_at: new Date().toISOString(),
      status: 'clicked',
    })
    .eq('id', campaign.id);

  // Get associated admin promotion
  const { data: promotion, error: promotionError } = await supabase
    .from('admin_promotion_events')
    .select('user_id')
    .eq('id', campaign.admin_promotion_id)
    .single();

  if (!promotion) {
    throw new Error('Associated promotion not found');
  }

  // Audit log
  await auditLog(promotion.user_id, 'PHISHING_LINK_CLICKED', {
    campaignId: campaign.id,
    ipAddress,
  });

  return campaign.honey_pot_token;
}

/**
 * Handle credentials entered (honeypot form submission)
 */
export async function handleCredentialsEntered(
  token: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  // Get campaign from token
  const { data: campaign, error: campaignError } = await supabase
    .from('phishing_campaigns')
    .select('*')
    .eq('honey_pot_token', token)
    .single();

  if (campaignError || !campaign) {
    throw new Error('Invalid honey pot token');
  }

  // Get associated admin promotion
  const { data: promotion, error: promotionError } = await supabase
    .from('admin_promotion_events')
    .select('user_id')
    .eq('id', campaign.admin_promotion_id)
    .single();

  if (!promotion) {
    throw new Error('Associated promotion not found');
  }

  const userId = promotion.user_id;

  // Update campaign
  const remediation = await createRemediationCourse(userId, campaign.id);

  await supabase
    .from('phishing_campaigns')
    .update({
      credentials_entered_at: new Date().toISOString(),
      status: 'credentials_entered',
      remediation_required_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', campaign.id);

  // Suspend account
  const suspendedUntil = new Date();
  suspendedUntil.setHours(suspendedUntil.getHours() + 1); // 1 hour suspension

  await suspendAccount(
    userId,
    'Security Training Required: Phishing simulation credentials were entered. Complete mandatory cybersecurity training to restore access.',
    remediation.id,
    1
  );

  // Audit log
  await auditLog(userId, 'PHISHING_CREDENTIALS_CAPTURED', {
    campaignId: campaign.id,
    campaignType: campaign.campaign_type,
    ipAddress,
  });

  await auditLog(userId, 'ACCOUNT_SUSPENDED_FOR_PHISHING', {
    campaignId: campaign.id,
    remediationCourseId: remediation.id,
  });

  console.log(`Account suspended for user ${userId} - remediation required`);
}

export default {
  triggerPhishingSimulation,
  handleHoneyPotClick,
  handleCredentialsEntered,
};