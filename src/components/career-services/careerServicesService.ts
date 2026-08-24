/**
 * Career Services Portal — Service Layer
 *
 * Mock job postings, applications, resume reviews, interview prep,
 * trends, company stats, and insights.
 */

import {
  JobPosting, Application, ResumeReview, InterviewPrep,
  CareerTrend, CompanyStats, CareerInsight, CareerSummary,
  JobType, JobStatus, ApplicationStatus, Industry,
} from './careerServicesTypes';

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = () => Math.random().toString(36).substring(2, 10);

const FIRST = ['Aisha','Brent','Carmen','David','Elena','Faisal','Grace','Hiroshi','Ines','James','Kavita','Liam','Mei','Nadia','Oscar','Priya','Quinn','Ravi','Sofia','Tariq','Uma','Victor','Wendy','Xavier','Yuki','Zara'];
const LAST = ['Patel','Kim','Mueller','Santos','Nakamura','Okafor','Silva','Singh','Johansson','Tanaka','Chen','Rodriguez','Ali','Nguyen','Kowalski','Ibrahim','Kapoor','Olsen','Sato','Garcia','Das','Brown','Lee'];
const COMPANIES = ['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Tesla', 'Netflix', 'Stripe', 'Airbnb', 'Shopify', 'Goldman Sachs', 'McKinsey', 'Deloitte', 'JPMorgan', 'Cisco'];

// ── Job Postings ───────────────────────────────────────────────────────────

function generateJobPostings(): JobPosting[] {
  const jobs: Omit<JobPosting, 'id'>[] = [
    { title: 'Software Engineering Intern', company: 'Google', industry: 'Technology', type: 'Internship', status: 'Open', description: 'Work on real projects with a team of engineers. Build scalable systems.', requirements: ['CS or related major', 'Python/Java/C++', 'Data structures & algorithms'], salaryMin: 8000, salaryMax: 12000, location: 'Mountain View, CA', isRemote: false, deadline: '2026-09-30', postedAt: '2026-08-01', applicantCount: 245, skills: ['Python', 'Java', 'Algorithms'], contactEmail: 'recruiting@google.com' },
    { title: 'Data Science Intern', company: 'Microsoft', industry: 'Technology', type: 'Internship', status: 'Open', description: 'Analyze large datasets and build ML models for Azure services.', requirements: ['Statistics/CS background', 'Python', 'SQL', 'Machine Learning'], salaryMin: 7500, salaryMax: 11000, location: 'Redmond, WA', isRemote: true, deadline: '2026-10-15', postedAt: '2026-08-05', applicantCount: 189, skills: ['Python', 'ML', 'SQL', 'Statistics'], contactEmail: 'interns@microsoft.com' },
    { title: 'Full-Stack Developer', company: 'Stripe', industry: 'Technology', type: 'Full-Time', status: 'Open', description: 'Build and maintain payment infrastructure used by millions.', requirements: ['3+ years experience', 'React', 'Node.js', 'PostgreSQL'], salaryMin: 120000, salaryMax: 180000, location: 'San Francisco, CA', isRemote: true, deadline: '2026-11-01', postedAt: '2026-08-10', applicantCount: 156, skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript'], contactEmail: 'jobs@stripe.com' },
    { title: 'Investment Banking Analyst', company: 'Goldman Sachs', industry: 'Finance', type: 'Full-Time', status: 'Open', description: 'Financial modeling, valuation, and deal execution.', requirements: ['Finance/Economics major', 'Excel modeling', 'Bloomberg terminal'], salaryMin: 95000, salaryMax: 130000, location: 'New York, NY', isRemote: false, deadline: '2026-09-15', postedAt: '2026-07-20', applicantCount: 312, skills: ['Financial Modeling', 'Excel', 'Valuation'], contactEmail: 'campus@goldmansachs.com' },
    { title: 'Product Design Intern', company: 'Airbnb', industry: 'Technology', type: 'Internship', status: 'Open', description: 'Design intuitive experiences for hosts and guests.', requirements: ['Design portfolio', 'Figma', 'User research skills'], salaryMin: 7000, salaryMax: 10000, location: 'San Francisco, CA', isRemote: true, deadline: '2026-10-01', postedAt: '2026-08-12', applicantCount: 178, skills: ['Figma', 'UX Research', 'Prototyping'], contactEmail: 'design-interns@airbnb.com' },
    { title: 'Management Consultant', company: 'McKinsey', industry: 'Consulting', type: 'Full-Time', status: 'Open', description: 'Solve complex business problems for Fortune 500 clients.', requirements: ['Top university', 'Analytical skills', 'Case interview prep'], salaryMin: 100000, salaryMax: 150000, location: 'Chicago, IL', isRemote: false, deadline: '2026-09-20', postedAt: '2026-08-01', applicantCount: 420, skills: ['Analytics', 'Communication', 'Problem Solving'], contactEmail: 'campus@mckinsey.com' },
    { title: 'Marketing Intern', company: 'Netflix', industry: 'Media', type: 'Internship', status: 'Closed', description: 'Support content marketing and social media campaigns.', requirements: ['Marketing major', 'Social media experience', 'Analytics tools'], salaryMin: 6000, salaryMax: 8000, location: 'Los Angeles, CA', isRemote: false, deadline: '2026-08-15', postedAt: '2026-07-01', applicantCount: 287, skills: ['Marketing', 'Analytics', 'Content Creation'], contactEmail: 'careers@netflix.com' },
    { title: 'Cybersecurity Analyst', company: 'Cisco', industry: 'Technology', type: 'Full-Time', status: 'Open', description: 'Protect enterprise networks and respond to security incidents.', requirements: ['Cybersecurity degree', 'Network+ or Security+', 'Splunk experience'], salaryMin: 85000, salaryMax: 120000, location: 'Austin, TX', isRemote: true, deadline: '2026-10-30', postedAt: '2026-08-15', applicantCount: 98, skills: ['Network Security', 'Splunk', 'Incident Response'], contactEmail: 'security-jobs@cisco.com' },
  ];
  return jobs.map(j => ({ ...j, id: uid() }));
}

// ── Applications ───────────────────────────────────────────────────────────

function generateApplications(jobs: JobPosting[]): Application[] {
  const apps: Application[] = [];
  const statuses: ApplicationStatus[] = ['Applied', 'Under Review', 'Interview Scheduled', 'Offer Received', 'Rejected', 'Withdrawn'];
  for (const job of jobs.slice(0, 6)) {
    for (let i = 0; i < rand(3, 8); i++) {
      const status = pick(statuses);
      apps.push({
        id: uid(), jobId: job.id, jobTitle: job.title, company: job.company,
        studentId: `STU-${rand(1000, 9999)}`,
        studentName: `${pick(FIRST)} ${pick(LAST)}`,
        status, appliedAt: `2026-${String(rand(7, 8)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`,
        lastUpdated: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
        interviewDate: status === 'Interview Scheduled' ? `2026-09-${String(rand(1, 28)).padStart(2, '0')}` : undefined,
        offerAmount: status === 'Offer Received' ? rand(70000, 180000) : undefined,
      });
    }
  }
  return apps;
}

// ── Resume Reviews ─────────────────────────────────────────────────────────

function generateResumeReviews(): ResumeReview[] {
  return Array.from({ length: 12 }, () => {
    const score = rand(45, 95);
    return {
      id: uid(), studentId: `STU-${rand(1000, 9999)}`,
      studentName: `${pick(FIRST)} ${pick(LAST)}`,
      reviewerName: `${pick(FIRST)} ${pick(LAST)}`,
      score,
      categories: [
        { name: 'Content', score: rand(40, 100) },
        { name: 'Format', score: rand(50, 100) },
        { name: 'Keywords', score: rand(30, 95) },
        { name: 'Impact', score: rand(35, 100) },
        { name: 'Clarity', score: rand(45, 100) },
      ],
      strengths: pick([['Strong technical skills', 'Clear formatting'], ['Quantified achievements', 'Good keyword usage'], ['Relevant experience', 'Professional summary']]),
      improvements: pick([['Add more metrics', 'Improve summary'], ['Tailor to job description', 'Remove outdated info'], ['Strengthen action verbs', 'Add certifications']]),
      submittedAt: `2026-08-${String(rand(1, 24)).padStart(2, '0')}`,
      status: pick(['Completed', 'Completed', 'In Progress', 'Pending'] as const),
    };
  });
}

// ── Interview Prep ─────────────────────────────────────────────────────────

function generateInterviewPrep(): InterviewPrep[] {
  return [
    { id: uid(), company: 'Google', role: 'SWE Intern', type: 'Technical', difficulty: 'Medium', questions: ['Two Sum variations', 'Binary tree traversal', 'Design URL shortener'], avgPreparationTime: 45, successRate: 62, completedBy: 89 },
    { id: uid(), company: 'Microsoft', role: 'DS Intern', type: 'Technical', difficulty: 'Medium', questions: ['SQL window functions', 'A/B testing design', 'Regression analysis'], avgPreparationTime: 40, successRate: 68, completedBy: 67 },
    { id: uid(), company: 'McKinsey', role: 'Consultant', type: 'Case Study', difficulty: 'Hard', questions: ['Market sizing', 'Profitability analysis', 'Market entry strategy'], avgPreparationTime: 60, successRate: 45, completedBy: 134 },
    { id: uid(), company: 'Stripe', role: 'Full-Stack Dev', type: 'System Design', difficulty: 'Hard', questions: ['Payment system design', 'Real-time ledger', 'Fraud detection pipeline'], avgPreparationTime: 55, successRate: 55, completedBy: 42 },
    { id: uid(), company: 'Goldman Sachs', role: 'IB Analyst', type: 'Behavioral', difficulty: 'Medium', questions: ['Walk me through a DCF', 'Why Goldman?', 'Tell me about a time you led'], avgPreparationTime: 30, successRate: 58, completedBy: 210 },
    { id: uid(), company: 'Airbnb', role: 'Design Intern', type: 'Behavioral', difficulty: 'Easy', questions: ['Portfolio walkthrough', 'Design challenge', 'Collaboration story'], avgPreparationTime: 25, successRate: 72, completedBy: 56 },
  ];
}

// ── Trends ─────────────────────────────────────────────────────────────────

function generateTrends(): CareerTrend[] {
  const months = ['2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07'];
  let postings = 40, apps = 200, interviews = 30, offers = 8, rate = 35;
  return months.map((month) => {
    postings = Math.max(25, Math.min(60, postings + rand(-5, 7)));
    apps = Math.max(150, Math.min(400, apps + rand(-20, 30)));
    interviews = Math.max(20, Math.min(50, interviews + rand(-3, 5)));
    offers = Math.max(5, Math.min(15, offers + rand(-2, 3)));
    rate = Math.max(25, Math.min(50, rate + rand(-3, 4)));
    return { month, newPostings: postings, totalApplications: apps, interviewsScheduled: interviews, offersExtended: offers, placementRate: rate };
  });
}

// ── Company Stats ──────────────────────────────────────────────────────────

function generateCompanyStats(jobs: JobPosting[]): CompanyStats[] {
  return COMPANIES.map(company => {
    const compJobs = jobs.filter(j => j.company === company);
    return {
      company, industry: pick(['Technology', 'Finance', 'Consulting', 'Media'] as Industry[]),
      postingsCount: compJobs.length || rand(1, 3),
      totalApplicants: compJobs.reduce((s, j) => s + j.applicantCount, 0) || rand(50, 300),
      avgSalary: rand(80000, 160000),
      responseRate: rand(60, 95),
      hiredCount: rand(1, 5),
    };
  }).sort((a, b) => b.totalApplicants - a.totalApplicants);
}

// ── Insights ───────────────────────────────────────────────────────────────

function generateInsights(): CareerInsight[] {
  return [
    { id: uid(), title: 'Tech internships most popular', description: '55% of applications target technology roles. Google leads with 245 applicants.', type: 'positive', metric: 'Tech Share', value: '55%', trend: 'up' },
    { id: uid(), title: 'Placement rate at 38%', description: 'Up from 32% last year. Resume review program contributing to improvement.', type: 'positive', metric: 'Placement', value: '38%', trend: 'up' },
    { id: uid(), title: 'Google internship deadline in 5 weeks', description: '245 applications already received. Encourage students to apply soon.', type: 'info', metric: 'Deadline', value: 'Sep 30', trend: 'stable' },
    { id: uid(), title: 'McKinsey case prep success low', description: 'Only 45% success rate on case interviews. Need more practice sessions.', type: 'warning', metric: 'Success Rate', value: '45%', trend: 'down' },
    { id: uid(), title: 'Resume scores averaging 68/100', description: 'Room for improvement in keywords and impact sections.', type: 'info', metric: 'Avg Score', value: '68/100', trend: 'stable' },
    { id: uid(), title: '12 offers received this month', description: 'Best month since graduation season. Tech and consulting leading.', type: 'positive', metric: 'Offers', value: '12', trend: 'up' },
  ];
}

// ── Dashboard Aggregator ───────────────────────────────────────────────────

export function getCareerServicesData() {
  const jobPostings = generateJobPostings();
  const applications = generateApplications(jobPostings);
  const resumeReviews = generateResumeReviews();
  const interviewPrep = generateInterviewPrep();
  const trends = generateTrends();
  const companyStats = generateCompanyStats(jobPostings);
  const insights = generateInsights();

  const summary: CareerSummary = {
    totalPostings: jobPostings.length,
    openPostings: jobPostings.filter(j => j.status === 'Open').length,
    totalApplications: applications.length,
    interviewsScheduled: applications.filter(a => a.status === 'Interview Scheduled').length,
    offersReceived: applications.filter(a => a.status === 'Offer Received').length,
    placementRate: Math.round(applications.filter(a => a.status === 'Offer Received').length / applications.length * 100),
    avgSalary: Math.round(jobPostings.filter(j => j.salaryMin).reduce((s, j) => s + ((j.salaryMin || 0) + (j.salaryMax || 0)) / 2, 0) / Math.max(jobPostings.filter(j => j.salaryMin).length, 1)),
    topIndustry: 'Technology' as Industry,
    topJobType: 'Internship' as JobType,
    resumeReviews: resumeReviews.length,
    avgResumeScore: Math.round(resumeReviews.reduce((s, r) => s + r.score, 0) / resumeReviews.length),
  };

  return { jobPostings, applications, resumeReviews, interviewPrep, trends, companyStats, insights, summary };
}
