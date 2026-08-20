/**
 * Study Group & Collaborative Project Room Engine
 * High-performance state management for peer matching, schedule overlap algorithms,
 * live whiteboarding notes, task progress reducers, and peer feedback rubrics.
 */

export interface StudentPeerProfile {
    id: string;
    fullName: string;
    avatarUrl: string;
    major: string;
    academicYear: string;
    compatibilityScore: number;
    preferredStudyMode: 'Quiet Focus' | 'Active Discussion' | 'Exam Drill';
    availabilitySlots: string[];
    enrolledCourses: string[];
}

export interface CollaborativeProjectRoom {
    id: string;
    roomName: string;
    courseCode: string;
    targetDeadline: string;
    memberCount: number;
    maxCapacity: number;
    activeTopic: string;
    sharedNotes: string[];
    milestones: { id: string; title: string; completed: boolean; assignedTo: string }[];
}

export const MOCK_PEER_PROFILES: StudentPeerProfile[] = [
    {
        id: "peer_1",
        fullName: "Alex Rivera",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        major: "Computer Science",
        academicYear: "Junior (Class of '27)",
        compatibilityScore: 96,
        preferredStudyMode: "Active Discussion",
        availabilitySlots: ["Mon/Wed 4:00 PM - 6:00 PM", "Fri 2:00 PM - 5:00 PM"],
        enrolledCourses: ["CS301 Algorithms", "CS350 Operating Systems", "MATH240 Linear Algebra"]
    },
    {
        id: "peer_2",
        fullName: "Sarah Chen",
        avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
        major: "Data Science & Math",
        academicYear: "Senior (Class of '26)",
        compatibilityScore: 91,
        preferredStudyMode: "Exam Drill",
        availabilitySlots: ["Tue/Thu 5:00 PM - 8:00 PM", "Sat 10:00 AM - 1:00 PM"],
        enrolledCourses: ["CS301 Algorithms", "STAT400 Machine Learning", "CS410 Database Systems"]
    },
    {
        id: "peer_3",
        fullName: "Marcus Johnson",
        avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
        major: "Software Engineering",
        academicYear: "Sophomore (Class of '28)",
        compatibilityScore: 85,
        preferredStudyMode: "Quiet Focus",
        availabilitySlots: ["Mon/Wed 6:00 PM - 9:00 PM", "Sun 1:00 PM - 4:00 PM"],
        enrolledCourses: ["CS350 Operating Systems", "MATH240 Linear Algebra"]
    }
];

export const MOCK_PROJECT_ROOMS: CollaborativeProjectRoom[] = [
    {
        id: "room_101",
        roomName: "CS301 Dynamic Programming Deep-Dive",
        courseCode: "CS301",
        targetDeadline: "Midterm Exam (Nov 15)",
        memberCount: 4,
        maxCapacity: 6,
        activeTopic: "Knapsack Problem & Matrix Chain Multiplication",
        sharedNotes: [
            "Remember: Memoization reduces time complexity from O(2^n) to O(n*W).",
            "Optimal substructure property must hold for DP to apply."
        ],
        milestones: [
            { id: "m1", title: "Solve LeetCode Top 15 DP Set", completed: true, assignedTo: "Alex Rivera" },
            { id: "m2", title: "Review Space-Optimized Tabulation", completed: false, assignedTo: "Sarah Chen" },
            { id: "m3", title: "Mock Exam Practice Run", completed: false, assignedTo: "Group" }
        ]
    },
    {
        id: "room_102",
        roomName: "OS Kernel Process Scheduling Lab 3",
        courseCode: "CS350",
        targetDeadline: "Project Submission (Nov 20)",
        memberCount: 3,
        maxCapacity: 4,
        activeTopic: "Round-Robin vs Multi-Level Feedback Queue",
        sharedNotes: [
            "Gantt chart visualization for turnaround time calculations.",
            "Preemption overhead considerations in Linux kernel."
        ],
        milestones: [
            { id: "m4", title: "Implement Ready Queue Scheduler", completed: true, assignedTo: "Marcus Johnson" },
            { id: "m5", title: "Write Context Switch Benchmark", completed: true, assignedTo: "Alex Rivera" }
        ]
    }
];

export const calculateCourseMatchPercentage = (studentCourses: string[], targetCourses: string[]): number => {
    if (targetCourses.length === 0) return 0;
    const common = studentCourses.filter(c => targetCourses.includes(c));
    return Math.round((common.length / Math.max(studentCourses.length, targetCourses.length)) * 100);
};
