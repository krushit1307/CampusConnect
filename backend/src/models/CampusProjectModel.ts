export interface ProjectPost {
  id: string;
  title: string;
  courseCode: string;
  department: string;
  projectType: 'capstone' | 'hackathon' | 'research' | 'coursework';
  ownerName: string;
  ownerAvatar: string;
  ownerRole: string;
  teamSize: number;
  openRoles: string[];
  requiredSkills: string[];
  description: string;
  status: 'recruiting' | 'in-progress' | 'completed';
  postedDate: string;
}

export interface ApplicationRequest {
  id: string;
  projectId: string;
  projectTitle: string;
  applicantName: string;
  applicantRole: string;
  appliedRole: string;
  pitch: string;
  skills: string[];
  status: 'pending' | 'accepted' | 'declined';
  appliedDate: string;
}

export interface ProjectFilterOptions {
  department: string;
  projectType: string;
  searchQuery: string;
}

const INITIAL_PROJECTS: ProjectPost[] = [
  {
    id: "proj-101",
    title: "AI-Powered Multimodal Document Plagiarism Visualizer",
    courseCode: "CS 490",
    department: "Computer Science",
    projectType: "capstone",
    ownerName: "Alexander Wright",
    ownerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    ownerRole: "Senior CS Student",
    teamSize: 4,
    openRoles: ["Frontend React Engineer", "ML Engineer"],
    requiredSkills: ["React", "TypeScript", "Python", "PyTorch"],
    description: "Building an automated document plagiarism detector using vector embeddings and OCR image processing for senior capstone.",
    status: "recruiting",
    postedDate: "1 day ago",
  },
  {
    id: "proj-102",
    title: "Autonomous Quadcopter Pathfinding & Obstacle Avoidance",
    courseCode: "ECE 380",
    department: "Electrical Engineering",
    projectType: "research",
    ownerName: "Maya Patel",
    ownerAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    ownerRole: "Research Assistant",
    teamSize: 3,
    openRoles: ["Embedded C++ Developer", "Control Systems Lead"],
    requiredSkills: ["C++", "ROS", "Microcontrollers", "PID Control"],
    description: "Lab research project focusing on indoor drone navigation using LiDAR point clouds and real-time path planning.",
    status: "recruiting",
    postedDate: "3 days ago",
  },
  {
    id: "proj-103",
    title: "EcoTrack: Campus Carbon Footprint Analytics Web App",
    courseCode: "HACK 2026",
    department: "Computer Science",
    projectType: "hackathon",
    ownerName: "Liam O'Connor",
    ownerAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    ownerRole: "Fullstack Developer",
    teamSize: 4,
    openRoles: ["UI/UX Designer", "Backend Node Developer"],
    requiredSkills: ["Figma", "Node.js", "Express", "TailwindCSS"],
    description: "48-hour hackathon project to track campus dining waste and student carpooling carbon offsets.",
    status: "recruiting",
    postedDate: "Just now",
  },
];

const INITIAL_APPLICATIONS: ApplicationRequest[] = [
  {
    id: "app-201",
    projectId: "proj-101",
    projectTitle: "AI-Powered Multimodal Document Plagiarism Visualizer",
    applicantName: "Alex Mercer",
    applicantRole: "Fullstack Junior",
    appliedRole: "Frontend React Engineer",
    pitch: "I have 2 years of experience with React, TailwindCSS, and state management pipelines.",
    skills: ["React", "TypeScript", "TailwindCSS"],
    status: "pending",
    appliedDate: "Today, 9:30 AM",
  },
];

export class CampusProjectService {
  private static projects: ProjectPost[] = [...INITIAL_PROJECTS];
  private static applications: ApplicationRequest[] = [...INITIAL_APPLICATIONS];

  public static getProjects(options?: Partial<ProjectFilterOptions>): ProjectPost[] {
    let result = [...this.projects];
    if (!options) return result;

    if (options.department && options.department !== "All") {
      result = result.filter((p) => p.department === options.department);
    }

    if (options.projectType && options.projectType !== "All") {
      result = result.filter((p) => p.projectType === options.projectType);
    }

    if (options.searchQuery && options.searchQuery.trim() !== "") {
      const q = options.searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.courseCode.toLowerCase().includes(q) ||
          p.openRoles.some((r) => r.toLowerCase().includes(q)) ||
          p.requiredSkills.some((s) => s.toLowerCase().includes(q))
      );
    }

    return result;
  }

  public static getProjectById(id: string): ProjectPost | undefined {
    return this.projects.find((p) => p.id === id);
  }

  public static createProjectPost(
    post: Omit<ProjectPost, "id" | "status" | "postedDate">
  ): ProjectPost {
    const newPost: ProjectPost = {
      ...post,
      id: `proj-${Date.now()}`,
      status: "recruiting",
      postedDate: "Just now",
    };
    this.projects.unshift(newPost);
    return newPost;
  }

  public static getApplications(): ApplicationRequest[] {
    return [...this.applications];
  }

  public static applyToProject(
    projectId: string,
    applicantName: string,
    applicantRole: string,
    appliedRole: string,
    pitch: string,
    skills: string[]
  ): ApplicationRequest {
    const proj = this.getProjectById(projectId);
    if (!proj) throw new Error("Project post not found.");

    const newApp: ApplicationRequest = {
      id: `app-${Date.now()}`,
      projectId,
      projectTitle: proj.title,
      applicantName,
      applicantRole,
      appliedRole,
      pitch,
      skills,
      status: "pending",
      appliedDate: "Just now",
    };

    this.applications.unshift(newApp);
    return newApp;
  }

  public static updateApplicationStatus(appId: string, status: 'accepted' | 'declined'): boolean {
    const idx = this.applications.findIndex((a) => a.id === appId);
    if (idx !== -1) {
      this.applications[idx].status = status;
      return true;
    }
    return false;
  }
}
