/**
 * Research Lab & Undergraduate Application Engine
 * Data models, proposal submission reducers, applicant tracking systems,
 * and skill compatibility scoring logic for campus faculty research labs.
 */

export interface ResearchLabProject {
    id: string;
    labTitle: string;
    department: string;
    principalInvestigator: string;
    piTitle: string;
    requiredSkills: string[];
    compensationType: 'Paid Stipend' | 'Academic Credit (3 Units)' | 'Volunteer / Honors Thesis';
    weeklyHours: number;
    openingsCount: number;
    projectSummary: string;
    activeGrant: string;
}

export interface ResearchApplicationRecord {
    id: string;
    labProjectId: string;
    labTitle: string;
    applicantName: string;
    gpa: number;
    statementOfInterest: string;
    relevantExperience: string;
    submissionDate: string;
    status: 'Pending Review' | 'Interview Scheduled' | 'Accepted' | 'Declined';
}

export const MOCK_RESEARCH_LABS: ResearchLabProject[] = [
    {
        id: "lab_201",
        labTitle: "Autonomous Perception & Robotics AI Lab",
        department: "Computer Science & Robotics",
        principalInvestigator: "Dr. Eleanor Vance",
        piTitle: "Associate Professor of AI",
        requiredSkills: ["Python", "PyTorch", "ROS2", "Computer Vision"],
        compensationType: "Paid Stipend",
        weeklyHours: 12,
        openingsCount: 2,
        projectSummary: "Developing real-time sensor fusion algorithms for LiDAR-based off-road obstacle avoidance in autonomous rover fleets.",
        activeGrant: "NSF Cyber-Physical Systems (CPS) Grant #84920"
    },
    {
        id: "lab_202",
        labTitle: "Genomic Bio-Computing & CRISPR Sequence Analytics",
        department: "Bioengineering & Computational Biology",
        principalInvestigator: "Dr. Rajesh Kothari",
        piTitle: "Director of Genomics Infrastructure",
        requiredSkills: ["R", "Bioconductor", "Python", "Bioinformatics"],
        compensationType: "Academic Credit (3 Units)",
        weeklyHours: 10,
        openingsCount: 3,
        projectSummary: "Mapping off-target gene editing mutations using deep transformer language models applied to raw DNA sequencing reads.",
        activeGrant: "NIH Genomic Innovation Award #30219"
    },
    {
        id: "lab_203",
        labTitle: "Quantum Nanomaterials & Solid-State Physics Lab",
        department: "Physics & Materials Science",
        principalInvestigator: "Dr. Sophia Sterling",
        piTitle: "Chair of Applied Quantum Physics",
        requiredSkills: ["MATLAB", "LabVIEW", "Quantum Mechanics", "Data Analysis"],
        compensationType: "Paid Stipend",
        weeklyHours: 15,
        openingsCount: 1,
        projectSummary: "Characterizing topological insulator nanowires under ultra-low cryogenic temperatures (4 Kelvin) for quantum bit stability.",
        activeGrant: "DoE Quantum Hardware Initiative #77102"
    }
];

export const MOCK_APPLICATIONS: ResearchApplicationRecord[] = [
    {
        id: "app_1",
        labProjectId: "lab_201",
        labTitle: "Autonomous Perception & Robotics AI Lab",
        applicantName: "Dipanshu Batra",
        gpa: 3.92,
        statementOfInterest: "I have worked extensively with PyTorch vision transformers and ROS2 navigation stacks during my junior year coursework.",
        relevantExperience: "Undergraduate TA for CS301 Algorithms, Lead Perception Engineer for Campus Robotics Club.",
        submissionDate: "Oct 24, 2026",
        status: "Interview Scheduled"
    }
];

export const calculateSkillMatchCount = (studentSkills: string[], requiredSkills: string[]): number => {
    return requiredSkills.filter(skill =>
        studentSkills.some(s => s.toLowerCase() === skill.toLowerCase())
    ).length;
};
