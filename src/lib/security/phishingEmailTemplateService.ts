export type CampaignType = 'stripe_escrow' | 'university_it' | 'payment_processing' | 'security_alert';

export interface EmailTemplate {
  subject: string;
  fromEmail: string;
  fromName: string;
  htmlBody: string;
  textBody: string;
  urgencyLevel: 'high' | 'critical';
}

/**
 * Generate phishing simulation email
 */
export function generatePhishingEmail(
  campaignType: CampaignType,
  userEmail: string,
  userName: string,
  honeyPotUrl: string
): EmailTemplate {
  const templates: Record<CampaignType, (email: string, name: string, url: string) => EmailTemplate> = {
    stripe_escrow: (email, name, url) => ({
      subject: 'Action Required: Stripe Escrow Account Verification Failed',
      fromEmail: 'accounts-support@stripe-verification.com', // Typo-laden domain
      fromName: 'Stripe Support',
      htmlBody: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #0066cc; margin-top: 0;">⚠️ Action Required</h2>
                <p>Hi ${name},</p>
                <p>We've detected unusual activity on your Stripe escrow account associated with your club. Your account has been temporarily restricted pending verification.</p>
                <p><strong>What happened:</strong></p>
                <ul>
                  <li>Multiple failed payment attempts detected</li>
                  <li>Account was flagged for review by our fraud team</li>
                  <li>Your access to funds is limited until verified</li>
                </ul>
                <p style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                  <strong>⚠️ URGENT:</strong> Please verify your identity within 24 hours to restore full access. Failure to verify may result in account suspension.
                </p>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="background: #0066cc; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                    Verify Your Account Now
                  </a>
                </p>
                <p style="font-size: 12px; color: #666; margin-top: 30px;">
                  If you didn't request this verification, please contact Stripe Support immediately.
                </p>
              </div>
              <footer style="font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                <p>© 2026 Stripe, Inc. All rights reserved</p>
                <p>This is an automated message, please do not reply.</p>
              </footer>
            </div>
          </body>
        </html>
      `,
      textBody: `
Action Required: Stripe Escrow Account Verification Failed

Hi ${name},

We've detected unusual activity on your Stripe escrow account. Your account has been temporarily restricted.

URGENT: Verify your identity within 24 hours:
${url}

If you didn't request this, contact Stripe Support immediately.

© Stripe, Inc.
      `,
      urgencyLevel: 'critical',
    }),

    university_it: (email, name, url) => ({
      subject: 'URGENT: University IT Security Alert - Password Reset Required',
      fromEmail: 'itsecurity-alert@university-it.edu', // Looks official but slightly off
      fromName: 'University IT Security',
      htmlBody: `
        <html>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #fff; border: 2px solid #d32f2f; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #d32f2f; margin-top: 0;">🔒 Security Alert</h2>
                <p>Dear ${name},</p>
                <p>The University IT Security Team has detected suspicious login attempts on your account.</p>
                <p><strong>Alert Details:</strong></p>
                <ul>
                  <li>3 failed login attempts from unknown locations</li>
                  <li>Password strength needs to be updated</li>
                  <li>Account compliance: CRITICAL</li>
                </ul>
                <div style="background: #ffebee; padding: 15px; border-left: 4px solid #d32f2f; margin: 20px 0; border-radius: 4px;">
                  <strong style="color: #d32f2f;">ACTION REQUIRED IMMEDIATELY:</strong>
                  <p style="margin: 10px 0;">Click the link below to verify your identity and reset your password. This action expires in 2 hours.</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="background: #1976d2; color: white; padding: 14px 35px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Reset Password Now
                  </a>
                </p>
                <p style="font-size: 13px; color: #666;">
                  For security purposes, you may be asked to re-enter your current password before creating a new one.
                </p>
              </div>
              <footer style="font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
                <p>University IT Security Team | Do Not Share This Email</p>
              </footer>
            </div>
          </body>
        </html>
      `,
      textBody: `
URGENT: University IT Security Alert - Password Reset Required

Dear ${name},

Suspicious login attempts detected on your account.

ACTION REQUIRED IMMEDIATELY (expires in 2 hours):
${url}

University IT Security Team
      `,
      urgencyLevel: 'critical',
    }),

    payment_processing: (email, name, url) => ({
      subject: 'PCI Compliance: Your Payment Data Requires Verification',
      fromEmail: 'compliance@paymentservices-verify.com', // Slightly misspelled
      fromName: 'Payment Services Compliance',
      htmlBody: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h2 style="color: #c41e3a; margin-top: 0;">PCI Compliance Notice</h2>
                <p>Hello ${name},</p>
                <p>Your organization's payment processing account requires immediate verification to maintain PCI DSS compliance.</p>
                <p><strong>What We Need:</strong></p>
                <ul>
                  <li>Account verification</li>
                  <li>Updated payment processing authorization</li>
                  <li>Compliance certification renewal</li>
                </ul>
                <div style="background: #fff8e1; padding: 15px; border-left: 4px solid #fbc02d; margin: 20px 0;">
                  <p><strong>Non-compliance may result in:</strong></p>
                  <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>Account suspension</li>
                    <li>Fines up to $100,000 per month</li>
                    <li>Blocked transactions</li>
                  </ul>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="background: #c41e3a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                    Verify Compliance Now
                  </a>
                </p>
              </div>
              <footer style="font-size: 11px; color: #999;">
                <p>Payment Services Compliance Team</p>
              </footer>
            </div>
          </body>
        </html>
      `,
      textBody: `
PCI Compliance: Your Payment Data Requires Verification

Hello ${name},

Your account requires immediate verification to maintain PCI DSS compliance.

Verify now: ${url}

Non-compliance may result in fines and account suspension.

Payment Services Compliance Team
      `,
      urgencyLevel: 'critical',
    }),

    security_alert: (email, name, url) => ({
      subject: 'Security Alert: Suspicious Activity on Your Account',
      fromEmail: 'security-noreply@campusconect-security.com', // Misspelled CampusConnect
      fromName: 'CampusConnect Security',
      htmlBody: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: #fff; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px;">
                <h2 style="color: #1565c0;">🔐 Security Alert</h2>
                <p>Hi ${name},</p>
                <p>We detected suspicious activity on your CampusConnect account.</p>
                <p><strong>Recent Activity:</strong></p>
                <ul>
                  <li>Login from unknown device</li>
                  <li>Location: Multiple countries in 1 hour</li>
                  <li>Unusual data access patterns</li>
                </ul>
                <div style="background: #e3f2fd; padding: 15px; border-left: 4px solid #1565c0; margin: 20px 0;">
                  <p><strong>To secure your account:</strong></p>
                  <p>Please verify your identity immediately. We'll guide you through a quick verification process.</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${url}" style="background: #1565c0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                    Verify Your Identity
                  </a>
                </p>
                <p style="font-size: 12px; color: #666;">
                  If this wasn't you, your account may have been compromised. Please secure it immediately.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
      textBody: `
Security Alert: Suspicious Activity on Your Account

Hi ${name},

We detected suspicious activity on your CampusConnect account.

Verify your