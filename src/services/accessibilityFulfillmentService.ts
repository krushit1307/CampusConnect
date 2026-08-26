import {
  AccommodationCategory,
  AccommodationRequest,
  CategoryInfo,
  DispatcherInfo,
  FulfillmentMetrics,
  FulfillmentStage,
  FulfillmentStatus,
  StageConfig,
  UrgencyLevel,
} from "@/types/accessibilityFulfillment";

// ─── Stage Configurations ──────────────────────────────────────────────────

export const STAGE_CONFIGS: StageConfig[] = [
  {
    stage: "submitted",
    label: "Request Logged",
    shortDescription: "Ticket created & received by Access Team",
    detailedDescription: "Your accommodation request has been logged into the CampusConnect real-time system and routed to the Access Ops team.",
    icon: "ClipboardCheck",
    estimatedDurationMins: 2,
  },
  {
    stage: "triaged",
    label: "Needs Triaged",
    shortDescription: "Requirements validated & specialist assigned",
    detailedDescription: "Staff have reviewed venue specifications, verified equipment/specialist availability, and assigned a lead dispatcher.",
    icon: "Search",
    estimatedDurationMins: 3,
  },
  {
    stage: "dispatched",
    label: "Specialist Dispatched",
    shortDescription: "En route to venue with requested materials",
    detailedDescription: "Access Specialist is traveling across campus with the required equipment/services. Live GPS location is active.",
    icon: "Truck",
    estimatedDurationMins: 8,
  },
  {
    stage: "in_progress",
    label: "On-Site Setup",
    shortDescription: "Setting up equipment & verifying active service",
    detailedDescription: "Specialist is on-site at your venue deploying equipment, establishing ASL/CART stream, or completing seating setup.",
    icon: "Wrench",
    estimatedDurationMins: 5,
  },
  {
    stage: "completed",
    label: "Fulfilled & Active",
    shortDescription: "Accommodation ready & verified complete",
    detailedDescription: "Accommodation setup is 100% complete and active. Student sign-off complete.",
    icon: "CheckCircle2",
    estimatedDurationMins: 0,
  },
];

export const CATEGORY_CONFIGS: CategoryInfo[] = [
  {
    id: "mobility",
    name: "Mobility & Ramp Services",
    description: "Portable ramps, wheelchair escorts, elevation assistance & accessible routes",
    iconName: "Accessibility",
    color: "#3B82F6", // blue-500
    badgeBg: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    examples: ["Portable threshold ramp", "Wheelchair escort", "Accessible elevator pass"],
  },
  {
    id: "auditory",
    name: "Auditory & Captioning",
    description: "Live ASL interpreters, CART captioning, FM listening headsets",
    iconName: "Ear",
    color: "#8B5CF6", // purple-500
    badgeBg: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    examples: ["Live ASL interpreter", "CART real-time captioning", "Assistive listening headset"],
  },
  {
    id: "visual",
    name: "Visual & Tactile Media",
    description: "Braille handouts, tactile floor maps, sighted guides & high-contrast displays",
    iconName: "Eye",
    color: "#EC4899", // pink-500
    badgeBg: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    examples: ["Braille event schedule", "Sighted guide assistance", "Tactile building map"],
  },
  {
    id: "cognitive",
    name: "Cognitive & Quiet Space",
    description: "Low-sensory quiet room reservation, noise-cancelling equipment, extended time setup",
    iconName: "Brain",
    color: "#10B981", // emerald-500
    badgeBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    examples: ["Quiet exam space", "Sensory relief headset", "Visual schedule guide"],
  },
  {
    id: "spatial",
    name: "Spatial & Ergonomic Seating",
    description: "Reserved front-row seating, height-adjustable tables, companion chairs",
    iconName: "Armchair",
    color: "#F59E0B", // amber-500
    badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    examples: ["Height-adjustable desk", "Front-row ASL sightline seat", "Companion seating reservation"],
  },
];

// Sample Initial Requests
const SAMPLE_DISPATCHERS: DispatcherInfo[] = [
  {
    id: "disp-1",
    name: "Marcus Vance",
    role: "Mobility Logistics Lead",
    phone: "(555) 234-8901",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    currentLocation: { lat: 37.7742, lng: -122.4185 },
  },
  {
    id: "disp-2",
    name: "Sarah Lin, CI/CT",
    role: "ASL & CART Coordinator",
    phone: "(555) 876-1234",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    currentLocation: { lat: 37.7758, lng: -122.4162 },
  },
  {
    id: "disp-3",
    name: "David Kim",
    role: "Assistive Tech & Tactile Lead",
    phone: "(555) 456-7890",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    currentLocation: { lat: 37.7735, lng: -122.4195 },
  },
];

const INITIAL_REQUESTS: AccommodationRequest[] = [
  {
    id: "ACC-9042",
    studentId: "user-101",
    studentName: "Jordan Rivers",
    studentAvatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    category: "auditory",
    accommodationType: "Live ASL Interpreter & Front Row Seat",
    eventOrLocation: "Annual Science & Tech Innovation Symposium",
    buildingName: "Science Complex - Hall B",
    roomNumber: "Auditorium 101",
    urgency: "high",
    currentStage: "dispatched",
    status: "on_schedule",
    dispatcher: SAMPLE_DISPATCHERS[1],
    destinationLocation: { lat: 37.7765, lng: -122.4150 },
    etaMinutes: 6,
    submittedAt: new Date(Date.now() - 14 * 60 * 1000),
    estimatedFulfillmentAt: new Date(Date.now() + 6 * 60 * 1000),
    notes: "Requires clear sightline to main stage presentation screen.",
    stageTimestamps: {
      submitted: new Date(Date.now() - 14 * 60 * 1000),
      triaged: new Date(Date.now() - 11 * 60 * 1000),
      dispatched: new Date(Date.now() - 4 * 60 * 1000),
    },
    timelineLogs: [
      {
        id: "log-1",
        stage: "submitted",
        text: "Request submitted for Live ASL Interpreter at Science Complex Hall B.",
        timestamp: new Date(Date.now() - 14 * 60 * 1000),
        author: "Jordan Rivers",
        role: "student",
      },
      {
        id: "log-2",
        stage: "triaged",
        text: "Triaged by Access Ops. Certified interpreter Sarah Lin assigned.",
        timestamp: new Date(Date.now() - 11 * 60 * 1000),
        author: "Access Center Ops",
        role: "staff",
      },
      {
        id: "log-3",
        stage: "dispatched",
        text: "Sarah Lin dispatched with FM transmitter kit. ETA 6 mins.",
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
        author: "Sarah Lin",
        role: "dispatcher",
      },
    ],
  },
  {
    id: "ACC-9043",
    studentId: "user-102",
    studentName: "Elena Rostova",
    studentAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    category: "mobility",
    accommodationType: "Portable Ramp & Wheelchair Escort",
    eventOrLocation: "Spring Career Fair 2026",
    buildingName: "Student Activity Center",
    roomNumber: "Main Gymnasium",
    urgency: "immediate",
    currentStage: "in_progress",
    status: "on_schedule",
    dispatcher: SAMPLE_DISPATCHERS[0],
    destinationLocation: { lat: 37.7750, lng: -122.4175 },
    etaMinutes: 2,
    submittedAt: new Date(Date.now() - 20 * 60 * 1000),
    estimatedFulfillmentAt: new Date(Date.now() + 2 * 60 * 1000),
    notes: "Entrance threshold at North Gate has 3 steps; temporary ramp deploy needed.",
    stageTimestamps: {
      submitted: new Date(Date.now() - 20 * 60 * 1000),
      triaged: new Date(Date.now() - 17 * 60 * 1000),
      dispatched: new Date(Date.now() - 10 * 60 * 1000),
      in_progress: new Date(Date.now() - 3 * 60 * 1000),
    },
    timelineLogs: [
      {
        id: "log-4",
        stage: "submitted",
        text: "Immediate ramp request created for North Gate entrance.",
        timestamp: new Date(Date.now() - 20 * 60 * 1000),
        author: "Elena Rostova",
        role: "student",
      },
      {
        id: "log-5",
        stage: "triaged",
        text: "Priority triage approved. Heavy-duty aluminum ramp dispatched.",
        timestamp: new Date(Date.now() - 17 * 60 * 1000),
        author: "Access Center Ops",
        role: "staff",
      },
      {
        id: "log-6",
        stage: "dispatched",
        text: "Marcus Vance en route with mobile ramp transport cart.",
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        author: "Marcus Vance",
        role: "dispatcher",
      },
      {
        id: "log-7",
        stage: "in_progress",
        text: "Marcus Vance arrived on site. Unlocking & securing ramp at North Gate.",
        timestamp: new Date(Date.now() - 3 * 60 * 1000),
        author: "Marcus Vance",
        role: "dispatcher",
      },
    ],
  },
  {
    id: "ACC-9044",
    studentId: "user-103",
    studentName: "Alex Mercer",
    studentAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    category: "visual",
    accommodationType: "Braille Handouts & Sighted Guide",
    eventOrLocation: "Campus Debate Championship",
    buildingName: "Law School Library",
    roomNumber: "Moot Courtroom 2",
    urgency: "medium",
    currentStage: "triaged",
    status: "on_schedule",
    dispatcher: SAMPLE_DISPATCHERS[2],
    destinationLocation: { lat: 37.7730, lng: -122.4200 },
    etaMinutes: 12,
    submittedAt: new Date(Date.now() - 5 * 60 * 1000),
    estimatedFulfillmentAt: new Date(Date.now() + 12 * 60 * 1000),
    notes: "Requires tactile debate schedule printout and escort from main entrance.",
    stageTimestamps: {
      submitted: new Date(Date.now() - 5 * 60 * 1000),
      triaged: new Date(Date.now() - 2 * 60 * 1000),
    },
    timelineLogs: [
      {
        id: "log-8",
        stage: "submitted",
        text: "Request submitted for Braille materials & sighted guide.",
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        author: "Alex Mercer",
        role: "student",
      },
      {
        id: "log-9",
        stage: "triaged",
        text: "Request validated. Embossing Braille sheets at Resource Hub.",
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        author: "David Kim",
        role: "staff",
      },
    ],
  },
  {
    id: "ACC-9040",
    studentId: "user-104",
    studentName: "Priya Sharma",
    studentAvatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    category: "cognitive",
    accommodationType: "Quiet Exam Room & Sensory Headphones",
    eventOrLocation: "Midterm Biology Assessment",
    buildingName: "Life Sciences Building",
    roomNumber: "Quiet Study Suite 3B",
    urgency: "low",
    currentStage: "completed",
    status: "completed",
    dispatcher: SAMPLE_DISPATCHERS[2],
    destinationLocation: { lat: 37.7745, lng: -122.4160 },
    etaMinutes: 0,
    submittedAt: new Date(Date.now() - 60 * 60 * 1000),
    estimatedFulfillmentAt: new Date(Date.now() - 35 * 60 * 1000),
    completedAt: new Date(Date.now() - 32 * 60 * 1000),
    notes: "Noise-cancelling headsets delivered and workstation configured.",
    stageTimestamps: {
      submitted: new Date(Date.now() - 60 * 60 * 1000),
      triaged: new Date(Date.now() - 55 * 60 * 1000),
      dispatched: new Date(Date.now() - 45 * 60 * 1000),
      in_progress: new Date(Date.now() - 38 * 60 * 1000),
      completed: new Date(Date.now() - 32 * 60 * 1000),
    },
    timelineLogs: [
      {
        id: "log-10",
        stage: "completed",
        text: "Priya Sharma verified room setup. Satisfaction rated 5/5.",
        timestamp: new Date(Date.now() - 32 * 60 * 1000),
        author: "Priya Sharma",
        role: "student",
      },
    ],
    studentFeedback: {
      rating: 5,
      comment: "Super fast turnaround! The quiet room was set up perfectly before my exam.",
      submittedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  },
];

// ─── Service State & Pub/Sub ──────────────────────────────────────────────

class AccessibilityFulfillmentService {
  private requests: AccommodationRequest[] = [...INITIAL_REQUESTS];
  private listeners: Set<() => void> = new Set();
  private simulationTimer: ReturnType<typeof setInterval> | null = null;
  private isSimulating: boolean = false;

  constructor() {
    this.startSimulation();
  }

  // Subscribe to changes
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // Query Methods
  public getAllRequests(): AccommodationRequest[] {
    return [...this.requests];
  }

  public getRequestById(id: string): AccommodationRequest | undefined {
    return this.requests.find((r) => r.id === id);
  }

  public getActiveRequests(): AccommodationRequest[] {
    return this.requests.filter((r) => r.currentStage !== "completed");
  }

  // Mutation Methods
  public createRequest(data: {
    studentId: string;
    studentName: string;
    studentAvatar?: string;
    category: AccommodationCategory;
    accommodationType: string;
    eventOrLocation: string;
    buildingName: string;
    roomNumber?: string;
    urgency: UrgencyLevel;
    notes?: string;
  }): AccommodationRequest {
    const randomIdNumber = Math.floor(1000 + Math.random() * 9000);
    const id = `ACC-${randomIdNumber}`;
    const now = new Date();
    
    // Choose initial dispatcher according to category
    let dispatcher: DispatcherInfo | undefined = undefined;
    if (data.category === "mobility") dispatcher = SAMPLE_DISPATCHERS[0];
    else if (data.category === "auditory") dispatcher = SAMPLE_DISPATCHERS[1];
    else dispatcher = SAMPLE_DISPATCHERS[2];

    const newRequest: AccommodationRequest = {
      id,
      studentId: data.studentId,
      studentName: data.studentName,
      studentAvatar: data.studentAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      category: data.category,
      accommodationType: data.accommodationType,
      eventOrLocation: data.eventOrLocation,
      buildingName: data.buildingName,
      roomNumber: data.roomNumber,
      urgency: data.urgency,
      currentStage: "submitted",
      status: "on_schedule",
      dispatcher,
      destinationLocation: { lat: 37.7750, lng: -122.4170 },
      etaMinutes: data.urgency === "immediate" ? 5 : data.urgency === "high" ? 10 : 15,
      submittedAt: now,
      estimatedFulfillmentAt: new Date(now.getTime() + 15 * 60 * 1000),
      notes: data.notes || "",
      stageTimestamps: {
        submitted: now,
      },
      timelineLogs: [
        {
          id: `log-${Date.now()}`,
          stage: "submitted",
          text: `Request logged for ${data.accommodationType} at ${data.buildingName}.`,
          timestamp: now,
          author: data.studentName,
          role: "student",
        },
      ],
    };

    this.requests.unshift(newRequest);
    this.notify();
    return newRequest;
  }

  public advanceStage(requestId: string, targetStage?: FulfillmentStage): AccommodationRequest | undefined {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return undefined;

    const stages: FulfillmentStage[] = ["submitted", "triaged", "dispatched", "in_progress", "completed"];
    const currentIndex = stages.indexOf(request.currentStage);

    let nextStage: FulfillmentStage;
    if (targetStage) {
      nextStage = targetStage;
    } else {
      if (currentIndex >= stages.length - 1) return request;
      nextStage = stages[currentIndex + 1];
    }

    const now = new Date();
    request.currentStage = nextStage;
    request.stageTimestamps[nextStage] = now;

    if (nextStage === "completed") {
      request.status = "completed";
      request.etaMinutes = 0;
      request.completedAt = now;
    } else if (nextStage === "in_progress") {
      request.etaMinutes = 2;
    } else if (nextStage === "dispatched") {
      request.etaMinutes = 7;
    }

    const stageConfig = STAGE_CONFIGS.find((s) => s.stage === nextStage);
    request.timelineLogs.push({
      id: `log-${Date.now()}-${Math.random()}`,
      stage: nextStage,
      text: `Stage updated to [${stageConfig?.label || nextStage}]. ${stageConfig?.shortDescription || ""}`,
      timestamp: now,
      author: request.dispatcher ? request.dispatcher.name : "Access Ops",
      role: request.dispatcher ? "dispatcher" : "staff",
    });

    this.notify();
    return request;
  }

  public setStatus(requestId: string, status: FulfillmentStatus, note?: string): AccommodationRequest | undefined {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return undefined;

    request.status = status;
    if (status === "delayed") {
      request.etaMinutes += 5;
    }

    if (note) {
      request.timelineLogs.push({
        id: `log-${Date.now()}`,
        stage: request.currentStage,
        text: `Status set to [${status.toUpperCase()}]: ${note}`,
        timestamp: new Date(),
        author: "Access Center Ops",
        role: "staff",
      });
    }

    this.notify();
    return request;
  }

  public submitFeedback(requestId: string, rating: number, comment?: string): boolean {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return false;

    request.studentFeedback = {
      rating,
      comment,
      submittedAt: new Date(),
    };

    request.timelineLogs.push({
      id: `log-${Date.now()}`,
      stage: "completed",
      text: `Student left ${rating}/5 star feedback: "${comment || "Service complete"}"`,
      timestamp: new Date(),
      author: request.studentName,
      role: "student",
    });

    this.notify();
    return true;
  }

  public addTimelineNote(requestId: string, text: string, author: string, role: "system" | "staff" | "student" | "dispatcher"): boolean {
    const request = this.requests.find((r) => r.id === requestId);
    if (!request) return false;

    request.timelineLogs.push({
      id: `log-${Date.now()}`,
      stage: request.currentStage,
      text,
      timestamp: new Date(),
      author,
      role,
    });

    this.notify();
    return true;
  }

  // Real-Time Simulation Engine
  public startSimulation() {
    if (this.simulationTimer) return;
    this.isSimulating = true;

    this.simulationTimer = setInterval(() => {
      let updated = false;

      this.requests.forEach((req) => {
        if (req.currentStage !== "completed" && req.status !== "delayed") {
          // Decrement ETA if > 1
          if (req.etaMinutes > 1) {
            req.etaMinutes -= 1;
            updated = true;
          }

          // Move dispatcher location slightly toward destination if dispatched
          if (req.currentStage === "dispatched" && req.dispatcher) {
            const dest = req.destinationLocation;
            const curr = req.dispatcher.currentLocation;
            req.dispatcher.currentLocation = {
              lat: curr.lat + (dest.lat - curr.lat) * 0.15,
              lng: curr.lng + (dest.lng - curr.lng) * 0.15,
            };
            updated = true;
          }
        }
      });

      if (updated) {
        this.notify();
      }
    }, 8000); // simulation pulse every 8 sec
  }

  public stopSimulation() {
    if (this.simulationTimer) {
      clearInterval(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.isSimulating = false;
    this.notify();
  }

  public isSimulationActive(): boolean {
    return this.isSimulating;
  }

  // Calculate Aggregated Metrics
  public getMetrics(): FulfillmentMetrics {
    const totalRequests = this.requests.length;
    const activeRequests = this.requests.filter((r) => r.currentStage !== "completed").length;
    const completedRequests = this.requests.filter((r) => r.currentStage === "completed").length;

    // Avg turnaround calculation
    let totalMinutes = 0;
    let countWithDuration = 0;
    this.requests.forEach((r) => {
      if (r.completedAt && r.submittedAt) {
        const diffMs = r.completedAt.getTime() - r.submittedAt.getTime();
        totalMinutes += diffMs / (1000 * 60);
        countWithDuration++;
      }
    });
    const avgResolutionMinutes = countWithDuration > 0 ? Math.round((totalMinutes / countWithDuration) * 10) / 10 : 14.5;

    // Satisfaction
    let totalRating = 0;
    let ratingCount = 0;
    this.requests.forEach((r) => {
      if (r.studentFeedback) {
        totalRating += r.studentFeedback.rating;
        ratingCount++;
      }
    });
    const satisfactionScore = ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 4.9;

    // On-Time Percentage
    const onTimeCount = this.requests.filter((r) => r.status === "on_schedule" || r.status === "completed").length;
    const onTimePercentage = totalRequests > 0 ? Math.round((onTimeCount / totalRequests) * 1000) / 10 : 96.5;

    return {
      totalRequests,
      activeRequests,
      completedRequests,
      avgResolutionMinutes,
      satisfactionScore,
      onTimePercentage,
    };
  }

  public resetToSample() {
    this.requests = [...INITIAL_REQUESTS];
    this.notify();
  }
}

export const accessibilityFulfillmentService = new AccessibilityFulfillmentService();
