import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export interface RemediationCourse {
  id: string;
  userId: string;
  campaignId: string | null;
  courseStartAt: string;
  courseCompletionAt: string | null;
  status: 'in_progress' | 'completed' | 'suspended';
  modulesCompleted: number;
  totalModules: number;
  currentModule: number;
}

export interface CourseModule {
  id: number;
  title: string;
  description: string;
  content: string;
  videoUrl?: string;
  estimatedDuration: number; // minutes
  quizQuestions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// Course modules
const COURSE_MODULES: CourseModule[] = [
  {
    id: 1,
    title: 'Understanding Social Engineering',
    description: 'Learn the fundamentals of social engineering attacks',
    content: `
Social engineering is the art of manipulating people into divulging confidential information or taking actions that compromise security.

Key Points:
- Social engineers exploit human psychology, not technical vulnerabilities
- They often research targets extensively before attacking
- Common techniques: pretexting, baiting, phishing, tailgating
- Why it works: people are generally helpful and trust authority figures

As an admin, you're a high-value target because:
- You have access to sensitive data and financial systems
- Attackers assume admins have elevated privileges
- You may be less suspicious of requests from familiar-looking sources
    `,
    estimatedDuration: 10,
    quizQuestions: [
      {
        id: 'q1-1',
        question: 'What is the primary target of social engineering?',
        options: [
          'Computer operating systems',
          'Human psychology and trust',
          'Firewall systems',
          'Database encryption',
        ],
        correctAnswer: 1,
        explanation: 'Social engineering targets human psychology and trust, not technical systems.',
      },
      {
        id: 'q1-2',
        question: 'Why are admins often targeted?',
        options: [
          'They have weaker passwords',
          'They have elevated access and control sensitive data',
          'They spend less time online',
          'None of the above',
        ],
        correctAnswer: 1,
        explanation: 'Admins are targeted because they have elevated access to sensitive systems and data.',
      },
    ],
  },
  {
    id: 2,
    title: 'Recognizing Phishing Techniques',
    description: 'Identify common phishing tactics and red flags',
    content: `
Phishing is a specific type of social engineering that uses fraudulent emails, messages, or websites to steal credentials.

Common Phishing Tactics:
- Email spoofing: Making emails appear from trusted sources
- URL manipulation: Disguising malicious links
- Creating urgency: "Action required immediately"
- Social proof: Using company logos, official-looking formatting
- Authority impersonation: Pretending to be IT, Finance, or management

Red Flags to Watch For:
✗ Requests for passwords or sensitive information
✗ Unusual sender email addresses (look carefully at domain)
✗ Grammatical errors or suspicious formatting
✗ Requests to click links or download attachments
✗ Creating artificial urgency or fear ("Account will be suspended")
✗ Mismatched or unusual domain names
✗ Generic greetings ("Dear User" instead of your name)

Case Study:
A university's financial officer received an email from "finance-noreply@university-finance.edu" requesting an urgent fund transfer. The real domain was "university-finance.eduu" (note the extra 'u'). The attacker stole $500,000 before the error was discovered.
    `,
    estimatedDuration: 12,
    quizQuestions: [
      {
        id: 'q2-1',
        question: 'Which is a red flag for phishing?',
        options: [
          'Email asking to verify your password',
          'Email from your IT department',
          'Email with company logo',
          'Email with proper formatting',
        ],
        correctAnswer: 0,
        explanation: 'Legitimate companies never ask for passwords via email.',
      },
      {
        id: 'q2-2',
        question: 'What should you do if you receive a suspicious email?',
        options: [
          'Click the link to verify if it's real',
          'Reply asking for clarification',
          'Report it to IT security without clicking links',
          'Forward it to other admins',
        ],
        correctAnswer: 2,
        explanation: 'Always report suspicious emails to IT security and avoid clicking links or attachments.',
      },
    ],
  },
  {
    id: 3,
    title: 'Email Red Flags and Best Practices',
    description: 'Detailed analysis of email security',
    content: `
Email Security Deep Dive

Email Headers: What to Check
- Sender's real email address (not display name)
- Reply-To address (may differ from sender)
- SPF, DKIM, DMARC validation headers

Domain Spoofing Examples:
- stripe.com vs strıpe.com (contains Cyrillic 'і')
- paypa1.com vs paypal.com (numeral '1' instead of 'l')
- university-finances.com vs university-finance.edu (wrong TLD)

Best Practices for Admins:
1. Hover over links before clicking (see actual URL)
2. Type URLs directly instead of clicking links
3. Verify requests through alternate channels (call the person)
4. Use multi-factor authentication
5. Keep software and systems updated
6. Report suspicious emails to IT

The Human Element:
Even tech-savvy people fall for phishing. It's not about intelligence—it's about:
- Time pressure ("Act now or account closes")
- Emotional triggers ("Unauthorized access", "Verify identity")
- Authority ("From CEO", "From IT Department")
- Familiarity ("From your bank")

You received a realistic phishing email in your simulation. This is exactly why training matters.
    `,
    estimatedDuration: 11,
    quizQuestions: [
      {
        id: 'q3-1',
        question: 'What should you check before clicking an email link?',
        options: [
          'If the sender looks official',
          'Hover over the link to see the actual URL',
          'If the email has a company logo',
          'If the email is well-written',
        ],
        correctAnswer: 1,
        explanation: 'Always hover over links to see the actual URL they point to, not the displayed text.',
      },
      {
        id: 'q3-2',
        question: 'How can attackers spoof email addresses?',
        options: [
          'By hacking the email server',
          'By using similar domain names or controlling legitimate mail servers',
          'By getting your password',
          'It's impossible',
        ],
        correctAnswer: 1,
        explanation: 'Attackers can use lookalike domains or compromise mail servers to spoof addresses.',
      },
    ],
  },
  {
    id: 4,
    title: 'Password Security Best Practices',
    description: 'Creating and protecting strong passwords',
    content: `
Password Security for High-Privilege Accounts

Your Admin Account is a Target:
- Admins are 10x more valuable targets than regular users
- Compromised admin account can affect thousands of users
- Attackers will use social engineering specifically to get your password

Strong Password Requirements:
✓ Minimum 16 characters (longer is better)
✓ Mix of uppercase, lowercase, numbers, symbols
✓ Avoid dictionary words or personal information
✓ Never reuse passwords across accounts
✓ Don't include your name or username

What NOT to Do:
✗ Writing passwords down or sharing via email
✗ Using the same password for multiple accounts
✗ Sending passwords via unencrypted channels
✗ Telling IT staff your password (they never need it)
✗ Storing passwords in browser
✗ Using simple patterns (1234, qwerty, etc.)

Multi-Factor Authentication (MFA):
MFA is essential for admin accounts:
- Something you know (password)
- Something you have (phone, security key)
- Something you are (fingerprint)

Even if someone gets your password, they can't access your account without the second factor.

Password Manager:
Use a reputable password manager:
- Remembers complex passwords safely
- Generates strong passwords
- Fills passwords only on correct websites
- Protects against phishing by not autofilling on fake sites

Recent Statistics:
- 81% of data breaches involve weak or stolen passwords
- Accounts without MFA are compromised 99.9% more often
- Average time to crack an 8-character password: 2 seconds
- Average time to crack a 16-character password: 200 years
    `,
    estimatedDuration: 10,
    quizQuestions: [
      {
        id: 'q4-1',
        question: 'What is a strong password?',
        options: [
          'Your birth year + name',
          '16+ characters with mixed case, numbers, and symbols',
          'A common word repeated',
          'Your username backwards',
        ],
        correctAnswer: 1,
        explanation: 'Strong passwords are 16+ characters with uppercase, lowercase, numbers, and symbols.',
      },
      {
        id: 'q4-2',
        question: 'Why should you enable MFA?',
        options: [
          'It's recommended but optional',
          'It makes login faster',
          'It prevents unauthorized access even if password is compromised',
          'To impress other admins',
        ],
        correctAnswer: 2,
        explanation: 'MFA prevents unauthorized access even if an attacker obtains your password.',
      },
    ],
  },
  {
    id: 5,
    title: 'Reporting Security Incidents',
    description: 'How and when to report security threats',
    content: `
Responding to Security Incidents

What to Do If You Suspect a Phishing Attack:

Immediate Actions:
1. DO NOT click any links or download attachments
2. DO NOT reply to the email
3. Report to IT Security immediately
   • Include the full email header
   • Take a screenshot if possible
   • Note the exact time received
4. Delete the email after reporting
5. Change your password if you clicked a link

What to Report:
✓ Suspicious emails (even if obvious)
✓ Unusual account activity
✓ Lost or stolen credentials
✓ Social engineering attempts via phone or in-person
✓ Compromised colleague accounts

Why Report Even "Obvious" Attacks?
- What seems obvious to you may trick others
- Attackers refine tactics based on what works
- One report helps identify patterns
- Early reporting prevents major breaches

Escalation Path:
1. IT Security Team (first responder)
2. Chief Information Security Officer (sensitive data)
3. Law Enforcement (if extortion or serious crime involved)
4. Executive Leadership (if institutional impact)

Your Simulation Email:
Remember the phishing email you received? That was intentional:
- If you fell for it: This training prepares you to spot real attacks
- If you caught it: You demonstrated good security awareness
- Either way: Reporting is the critical step

Case Study: The Ransomware Attack
An admin received a phishing email but didn't report it. The attacker gained access and deployed ransomware across the system. The delay in reporting cost the institution $2M+ in recovery, downtime, and ransom.

If that same admin had reported it immediately, IT could have:
- Quarantined the infected account
- Monitored for unauthorized access
- Prevented the spread to 500+ systems
- Avoided the entire incident

Your reporting culture matters.
    `,
    estimatedDuration: 10,
    quizQuestions: [
      {
        id: 'q5-1',
        question: 'What should you do if you click a phishing link?',
        options: [
          'Ignore it and continue working',
          'Report to IT immediately and change your password',
          'Wait to see if something happens',
          'Warn other users privately',
        ],
        correctAnswer: 1,
        explanation: 'Report immediately to IT and change your password if you clicked a malicious link.',
      },
      {
        id: 'q5-2',
        question: 'Why should you report obvious-looking phishing?',
        options: [
          'You're being paranoid',
          'To help identify attack patterns and protect others',
          'Because IT will be mad if you don't',
          'It will prevent all future attacks',
        ],
        correctAnswer: 1,
        explanation: 'Reporting helps IT identify attack patterns and prevents similar attacks on others.',
      },
    ],
  },
  {
    id: 6,
    title: 'Leadership Security Responsibilities',
    description: 'Your role in protecting your organization',
    content: `
You're Not Just Protecting Yourself

Admin Responsibility: Set the Security Culture

You Have Influence Over:
- How your club handles sensitive data
- Whether team members report security issues
- Creating a culture where security questions are welcomed
- Demonstrating that security is everyone's responsibility

Lead by Example:
✓ Use strong passwords and MFA
✓ Report suspicious activity
✓ Take security training seriously
✓ Ask questions when something seems off
✓ Never pressure others to bypass security
✓ Respect IT security guidance

Training Your Club Members:
- Teach basics: Don't share passwords, verify requests
- Create a reporting culture (don't punish reporters)
- Encourage questions: "Is this email real?"
- Make security approachable, not scary

Red Lines for Leaders:
✗ Pressuring employees to share passwords
✗ Sending sensitive data in unencrypted email
✗ Ignoring security warnings
✗ Accessing others' accounts
✗ Sharing admin credentials
✗ Circumventing security controls

Impact of Admin Compromise:
If your admin account is compromised:
- Attacker can access all club data
- Financial systems can be drained
- Member privacy can be violated
- Club reputation can be damaged
- Other members' accounts can be compromised

Your Leadership Advantage:
As an admin, you can:
1. Set security tone for your organization
2. Make reporting easy and non-punitive
3. Allocate resources to security
4. Be the person who catches phishing
5. Inspire a security-first culture

Final Reflection:
This training isn't punishment. It's preparation.

Real attackers are constantly evolving tactics. Your awareness and quick response time could be the difference between a detected phishing attempt and a million-dollar breach.

By completing this training, you've:
- Demonstrated commitment to security
- Learned real attack patterns
- Practiced incident response
- Earned the right to lead securely

Thank you for taking your security responsibilities seriously.
    `,
    estimatedDuration: 12,
    quizQuestions: [
      {
        id: 'q6-1',
        question: 'What is your responsibility as a club admin regarding security?',
        options: [
          'Only secure your own account',
          'Set security culture and protect organizational data',
          'Report all issues to university IT',
          'Ignore security if it slows things