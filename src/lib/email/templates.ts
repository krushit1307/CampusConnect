export interface VerificationEmailParams {
  recipientName: string;
  verificationUrl: string;
}

export function getVerificationEmailHtml({
  recipientName,
  verificationUrl,
}: VerificationEmailParams): string {
  const safeName = recipientName || "Student";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your CampusConnect Account</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f7f7f5;
      color: #000000;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 580px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 3px solid #000000;
      box-shadow: 6px 6px 0px #000000;
      padding: 32px;
    }
    .header {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 3px solid #000000;
    }
    .logo-brand {
      background-color: #000000;
      color: #ffffff;
      padding: 2px 8px;
    }
    .content {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .btn-container {
      margin: 32px 0;
      text-align: center;
    }
    .btn {
      display: inline-block;
      background-color: #a3e635;
      color: #000000;
      font-weight: 800;
      font-family: monospace;
      text-transform: uppercase;
      text-decoration: none;
      padding: 14px 28px;
      border: 3px solid #000000;
      box-shadow: 4px 4px 0px #000000;
      font-size: 14px;
    }
    .footer {
      margin-top: 32px;
      font-size: 12px;
      font-family: monospace;
      color: #666666;
      border-top: 1px solid #e5e5e5;
      padding-top: 16px;
    }
    .url-fallback {
      word-break: break-all;
      color: #2563eb;
      font-family: monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      CAMPUS<span class="logo-brand">CONNECT</span>
    </div>
    <div class="content">
      <p>Hey <strong>${safeName}</strong>,</p>
      <p>Welcome to CampusConnect! Please verify your college email address to unlock full access to events, clubs, and campus discussions.</p>
      <div class="btn-container">
        <a href="${verificationUrl}" class="btn" target="_blank">Verify Email Address &rarr;</a>
      </div>
      <p>If the button above does not work, copy and paste this link into your browser:</p>
      <p class="url-fallback">${verificationUrl}</p>
    </div>
    <div class="footer">
      <p>If you did not sign up for a CampusConnect account, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;
}

export function getVerificationEmailText({
  recipientName,
  verificationUrl,
}: VerificationEmailParams): string {
  const safeName = recipientName || "Student";
  return `
CAMPUSCONNECT - Verify your email address

Hey ${safeName},

Welcome to CampusConnect! Please verify your college email address by clicking the link below:

${verificationUrl}

If you did not sign up for a CampusConnect account, please ignore this email.
`.trim();
}
