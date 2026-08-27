// ============================================================
// CampusConnect – Study Group Service Layer
// src/services/StudyGroupService.ts
// ============================================================

export type GroupStatus = "active" | "scheduled" | "full" | "ended";
export type VibeType = "Intense Focus" | "Casual Chat" | "Exam Cram" | "Homework Help";

export interface GroupMember {
    id: string;
    name: string;
    avatar: string;
    major: string;
    isHost?: boolean;
}

export interface StudyGroup {
    id: string;
    title: string;
    courseCode: string;
    topic: string;
    location: string;
    roomNumber: string;
    hostId: string;
    members: GroupMember[];
    capacity: number;
    status: GroupStatus;
    vibe: VibeType;
    hasSnacks: boolean;
    isTutorPresent: boolean;
    startTime: string; // ISO string
    endTime: string;   // ISO string
}

export interface StudyGroupFilters {
    query: string;
    courseCode: string | "all";
    location: string | "all";
    status: GroupStatus | "all";
    hideFull: boolean;
}

const MOCK_GROUPS: StudyGroup[] = [
    {
        id: "sg-100",
        title: "Midterm 2 Cram Session",
        courseCode: "PHYS 220",
        topic: "Electromagnetism & Maxwell's Equations",
        location: "Main Library",
        roomNumber: "Study Room 3B",
        hostId: "u-10",
        members: [
            { id: "u-10", name: "David Kim", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=David", major: "Physics", isHost: true },
            { id: "u-11", name: "Sarah Lee", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", major: "Engineering" },
            { id: "u-12", name: "Mike Ross", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike", major: "Mathematics" },
        ],
        capacity: 6,
        status: "active",
        vibe: "Exam Cram",
        hasSnacks: true,
        isTutorPresent: true,
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endTime: new Date(Date.now() + 7200000).toISOString(),   // 2 hours from now
    },
    {
        id: "sg-101",
        title: "Project 4 Debugging",
        courseCode: "CS 3110",
        topic: "OCaml Data Structures",
        location: "Gates Hall",
        roomNumber: "Atrium Tables",
        hostId: "u-20",
        members: [
            { id: "u-20", name: "Alice Chen", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice", major: "CS", isHost: true },
            { id: "u-21", name: "Bob Smith", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob", major: "CS" },
        ],
        capacity: 4,
        status: "active",
        vibe: "Homework Help",
        hasSnacks: false,
        isTutorPresent: false,
        startTime: new Date(Date.now() - 1800000).toISOString(), // 30 mins ago
        endTime: new Date(Date.now() + 5400000).toISOString(),   // 1.5 hours from now
    },
    {
        id: "sg-102",
        title: "Silent Reading / Focus",
        courseCode: "ENGL 201",
        topic: "Modern American Lit",
        location: "Law Library",
        roomNumber: "Reading Room",
        hostId: "u-30",
        members: [
            { id: "u-30", name: "Eve Polastri", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Eve", major: "English", isHost: true },
        ],
        capacity: 8,
        status: "scheduled",
        vibe: "Intense Focus",
        hasSnacks: false,
        isTutorPresent: false,
        startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endTime: new Date(Date.now() + 93600000).toISOString(),
    },
    {
        id: "sg-103",
        title: "P-Set 7 Collaboration",
        courseCode: "MATH 141",
        topic: "Integration by Parts",
        location: "Student Union",
        roomNumber: "Food Court",
        hostId: "u-40",
        members: [
            { id: "u-40", name: "Jason Derulo", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jason", major: "Business", isHost: true },
            { id: "u-41", name: "Ariana G", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ariana", major: "Art" },
            { id: "u-42", name: "Billie E", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Billie", major: "Music" },
            { id: "u-43", name: "The Weeknd", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abel", major: "Comm" },
        ],
        capacity: 4,
        status: "full",
        vibe: "Casual Chat",
        hasSnacks: true,
        isTutorPresent: false,
        startTime: new Date(Date.now() - 7200000).toISOString(),
        endTime: new Date(Date.now() + 1800000).toISOString(),
    }
];

export function getDefaultGroupFilters(): StudyGroupFilters {
    return {
        query: "",
        courseCode: "all",
        location: "all",
        status: "active",
        hideFull: false
    };
}

export function fetchStudyGroups(filters: StudyGroupFilters): StudyGroup[] {
    let results = [...MOCK_GROUPS];

    if (filters.query.trim()) {
        const q = filters.query.toLowerCase();
        results = results.filter(
            r => r.title.toLowerCase().includes(q) ||
                r.topic.toLowerCase().includes(q) ||
                r.courseCode.toLowerCase().includes(q)
        );
    }

    if (filters.courseCode !== "all") results = results.filter(r => r.courseCode.startsWith(filters.courseCode));
    if (filters.location !== "all") results = results.filter(r => r.location === filters.location);
    if (filters.status !== "all") results = results.filter(r => r.status === filters.status);
    if (filters.hideFull) results = results.filter(r => r.members.length < r.capacity);

    // Sort: Active first, then scheduled, then full
    results.sort((a, b) => {
        const scores = { "active": 1, "scheduled": 2, "full": 3, "ended": 4 };
        return scores[a.status] - scores[b.status];
    });

    return results;
}

export function requestToJoinGroup(groupId: string): Promise<{ success: boolean; message: string }> {
    const group = MOCK_GROUPS.find(g => g.id === groupId);
    if (!group) return Promise.reject(new Error("Group not found"));
    if (group.members.length >= group.capacity) return Promise.reject(new Error("Group is full"));

    return new Promise((resolve) => {
        setTimeout(() => {
            // Simulate adding the current user
            group.members.push({
                id: "u-me",
                name: "You",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=You",
                major: "Undeclared"
            });
            if (group.members.length >= group.capacity) group.status = "full";

            resolve({ success: true, message: `Successfully joined ${group.title}! Check your messages for the exact table location.` });
        }, 1000);
    });
}
