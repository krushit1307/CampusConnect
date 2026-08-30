import { useState, useMemo } from "react";
import {
  Star, Users, BookOpen, TrendingUp, ThumbsUp, ThumbsDown,
  MessageSquare, Award, BarChart3, Search, Filter, ChevronRight,
  Clock, Target, Zap, Heart, AlertTriangle, CheckCircle, Eye,
  GraduationCap, Calendar, Hash,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────────
type Department = "cs" | "math" | "physics" | "english" | "business" | "psychology" | "biology" | "engineering" | "art" | "history";
type DifficultyLevel = "Easy" | "Medium" | "Hard" | "Very Hard";
type Semester = "Fall 2025" | "Spring 2026" | "Summer 2026" | "Fall 2026";
type ReviewSort = "newest" | "highest" | "lowest" | "helpful";
type GradeLetter = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";

interface Professor {
  id: string;
  name: string;
  department: Department;
  title: string;
  avatar: string;
  overallRating: number;
  totalReviews: number;
  difficulty: DifficultyLevel;
  wouldRecommend: number;
  numCourses: number;
  numStudents: number;
  topTags: string[];
  ratingHistory: { semester: string; rating: number }[];
  strengths: string[];
  weaknesses: string[];
}

interface Course {
  id: string;
  code: string;
  name: string;
  department: Department;
  credits: number;
  professorId: string;
  professorName: string;
  overallRating: number;
  difficultyRating: number;
  workloadRating: number;
  totalReviews: number;
  wouldRecommend: number;
  gradeDistribution: Record<GradeLetter, number>;
  topTags: string[];
  prerequisites: string[];
  description: string;
  semester: Semester;
  enrolled: number;
  capacity: number;
  schedule: string;
  location: string;
}

interface CourseReview {
  id: string;
  courseId: string;
  professorId: string;
  author: string;
  semester: Semester;
  rating: number;
  difficulty: number;
  workload: number;
  grade: GradeLetter;
  wouldRecommend: boolean;
  tags: string[];
  pros: string[];
  cons: string[];
  comment: string;
  date: string;
  helpfulCount: number;
  unhelpfulCount: number;
  isAnonymous: boolean;
}

// ─── Data ───────────────────────────────────────────────────────────────────────
const DEPT_COLORS: Record<Department, string> = {
  cs: "#3b82f6", math: "#a855f7", physics: "#f59e0b", english: "#ef4444",
  business: "#22c55e", psychology: "#ec4899", biology: "#10b981",
  engineering: "#6366f1", art: "#f97316", history: "#8b5cf6",
};

const DEPT_ICONS: Record<Department, string> = {
  cs: "💻", math: "📐", physics: "⚛️", english: "📝",
  business: "💼", psychology: "🧠", biology: "🧬",
  engineering: "⚙️", art: "🎨", history: "📜",
};

const GRADE_COLORS: Record<GradeLetter, string> = {
  "A+": "#22c55e", "A": "#22c55e", "A-": "#4ade80",
  "B+": "#3b82f6", "B": "#3b82f6", "B-": "#60a5fa",
  "C+": "#f59e0b", "C": "#f59e0b", "C-": "#fbbf24",
  "D": "#ef4444", "F": "#dc2626",
};

const difficultyColors: Record<DifficultyLevel, string> = {
  Easy: "#22c55e", Medium: "#f59e0b", Hard: "#ef4444", "Very Hard": "#dc2626",
};

const professors: Professor[] = [
  { id: "p1", name: "Dr. Sarah Chen", department: "cs", title: "Associate Professor", avatar: "👩‍🏫", overallRating: 4.8, totalReviews: 342, difficulty: "Medium", wouldRecommend: 95, numCourses: 4, numStudents: 890, topTags: ["Clear Lecturer", "Fair Grading", "Engaging"], strengths: ["Explains concepts clearly", "Responsive to questions", "Fair exams"], weaknesses: ["Fast-paced at times", "Office hours could be longer"], ratingHistory: [{ semester: "Fall 2024", rating: 4.7 }, { semester: "Spring 2025", rating: 4.8 }, { semester: "Fall 2025", rating: 4.9 }, { semester: "Spring 2026", rating: 4.8 }] },
  { id: "p2", name: "Prof. James Wilson", department: "math", title: "Professor", avatar: "👨‍🏫", overallRating: 4.2, totalReviews: 218, difficulty: "Hard", wouldRecommend: 78, numCourses: 3, numStudents: 567, topTags: ["Challenging", "Fair", "Expert"], strengths: ["Deep knowledge", "Fair grading", "Useful real-world examples"], weaknesses: ["Unclear explanations sometimes", "Dense homework"], ratingHistory: [{ semester: "Fall 2024", rating: 4.1 }, { semester: "Spring 2025", rating: 4.3 }, { semester: "Fall 2025", rating: 4.2 }, { semester: "Spring 2026", rating: 4.2 }] },
  { id: "p3", name: "Dr. Emily Patel", department: "physics", title: "Assistant Professor", avatar: "👩‍🔬", overallRating: 4.6, totalReviews: 156, difficulty: "Medium", wouldRecommend: 91, numCourses: 3, numStudents: 345, topTags: ["Passionate", "Clear", "Helpful"], strengths: ["Passionate about subject", "Excellent lab guidance", "Very approachable"], weaknesses: ["Some exams are tricky", "Limited textbook alternatives"], ratingHistory: [{ semester: "Fall 2024", rating: 4.5 }, { semester: "Spring 2025", rating: 4.6 }, { semester: "Fall 2025", rating: 4.7 }, { semester: "Spring 2026", rating: 4.6 }] },
  { id: "p4", name: "Prof. Maria Garcia", department: "business", title: "Professor", avatar: "👩‍💼", overallRating: 4.4, totalReviews: 289, difficulty: "Easy", wouldRecommend: 88, numCourses: 5, numStudents: 1234, topTags: ["Practical", "Fun", "Inspiring"], strengths: ["Real-world case studies", "Engaging lectures", "Networking opportunities"], weaknesses: ["Group projects can be uneven", "Some readings are tedious"], ratingHistory: [{ semester: "Fall 2024", rating: 4.3 }, { semester: "Spring 2025", rating: 4.4 }, { semester: "Fall 2025", rating: 4.5 }, { semester: "Spring 2026", rating: 4.4 }] },
  { id: "p5", name: "Dr. Robert Kim", department: "cs", title: "Professor", avatar: "👨‍💻", overallRating: 3.9, totalReviews: 198, difficulty: "Hard", wouldRecommend: 68, numCourses: 3, numStudents: 456, topTags: ["Expert", "Tough", "Fair"], strengths: ["Deep AI/ML expertise", "Cutting-edge research", "Fair exams"], weaknesses: ["Very heavy workload", "Unclear assignment specs", "Limited feedback"], ratingHistory: [{ semester: "Fall 2024", rating: 3.8 }, { semester: "Spring 2025", rating: 3.9 }, { semester: "Fall 2025", rating: 4.0 }, { semester: "Spring 2026", rating: 3.9 }] },
  { id: "p6", name: "Dr. Lisa Thompson", department: "english", title: "Associate Professor", avatar: "👩‍🎓", overallRating: 4.7, totalReviews: 267, difficulty: "Easy", wouldRecommend: 94, numCourses: 4, numStudents: 789, topTags: ["Inspiring", "Fair", "Supportive"], strengths: ["Passionate about literature", "Thoughtful feedback", "Inclusive discussions"], weaknesses: ["Heavy reading load", "Subjective grading on essays"], ratingHistory: [{ semester: "Fall 2024", rating: 4.6 }, { semester: "Spring 2025", rating: 4.7 }, { semester: "Fall 2025", rating: 4.8 }, { semester: "Spring 2026", rating: 4.7 }] },
];

const courses: Course[] = [
  { id: "c1", code: "CS 301", name: "Data Structures & Algorithms", department: "cs", credits: 4, professorId: "p1", professorName: "Dr. Sarah Chen", overallRating: 4.7, difficultyRating: 3.8, workloadRating: 4.0, totalReviews: 234, wouldRecommend: 92, gradeDistribution: { "A+": 15, "A": 28, "A-": 22, "B+": 18, "B": 10, "B-": 4, "C+": 2, "C": 1, "C-": 0, "D": 0, "F": 0 }, topTags: ["Core CS", "Practical", "Challenging"], prerequisites: ["CS 201", "MATH 201"], description: "Fundamental data structures and algorithm design techniques.", semester: "Fall 2026", enrolled: 180, capacity: 200, schedule: "MWF 10:00-10:50", location: "CS Building 101" },
  { id: "c2", code: "MATH 341", name: "Linear Algebra", department: "math", credits: 3, professorId: "p2", professorName: "Prof. James Wilson", overallRating: 4.1, difficultyRating: 4.2, workloadRating: 3.5, totalReviews: 189, wouldRecommend: 76, gradeDistribution: { "A+": 8, "A": 15, "A-": 18, "B+": 22, "B": 18, "B-": 10, "C+": 5, "C": 3, "C-": 1, "D": 0, "F": 0 }, topTags: ["Fundamental", "Theory", "Challenging"], prerequisites: ["MATH 201"], description: "Vector spaces, matrices, eigenvalues, and linear transformations.", semester: "Fall 2026", enrolled: 120, capacity: 140, schedule: "TTh 9:00-10:15", location: "Math Building 203" },
  { id: "c3", code: "PHYS 201", name: "Intro to Quantum Mechanics", department: "physics", credits: 4, professorId: "p3", professorName: "Dr. Emily Patel", overallRating: 4.5, difficultyRating: 3.9, workloadRating: 3.8, totalReviews: 112, wouldRecommend: 89, gradeDistribution: { "A+": 10, "A": 20, "A-": 22, "B+": 20, "B": 15, "B-": 8, "C+": 3, "C": 2, "C-": 0, "D": 0, "F": 0 }, topTags: ["Fascinating", "Lab Work", "Visual"], prerequisites: ["PHYS 101", "MATH 241"], description: "Introduction to quantum theory, wave functions, and Schrödinger equation.", semester: "Fall 2026", enrolled: 65, capacity: 80, schedule: "MWF 1:00-1:50", location: "Physics Lab 301" },
  { id: "c4", code: "BUS 310", name: "Marketing Strategy", department: "business", credits: 3, professorId: "p4", professorName: "Prof. Maria Garcia", overallRating: 4.3, difficultyRating: 2.8, workloadRating: 3.0, totalReviews: 312, wouldRecommend: 90, gradeDistribution: { "A+": 20, "A": 30, "A-": 25, "B+": 15, "B": 7, "B-": 2, "C+": 1, "C": 0, "C-": 0, "D": 0, "F": 0 }, topTags: ["Fun", "Practical", "Group Work"], prerequisites: ["BUS 201"], description: "Strategic marketing planning, consumer behavior, and brand management.", semester: "Fall 2026", enrolled: 210, capacity: 220, schedule: "TTh 2:00-3:15", location: "Business School 105" },
  { id: "c5", code: "CS 420", name: "Machine Learning", department: "cs", credits: 4, professorId: "p5", professorName: "Dr. Robert Kim", overallRating: 4.0, difficultyRating: 4.5, workloadRating: 4.8, totalReviews: 156, wouldRecommend: 72, gradeDistribution: { "A+": 5, "A": 12, "A-": 15, "B+": 20, "B": 22, "B-": 12, "C+": 8, "C": 4, "C-": 1, "D": 1, "F": 0 }, topTags: ["Cutting-Edge", "Heavy Workload", "Research"], prerequisites: ["CS 301", "MATH 341"], description: "Supervised and unsupervised learning algorithms, neural networks, and deep learning.", semester: "Fall 2026", enrolled: 95, capacity: 100, schedule: "MW 3:30-4:45", location: "CS Building 205" },
  { id: "c6", code: "ENG 215", name: "Modern American Literature", department: "english", credits: 3, professorId: "p6", professorName: "Dr. Lisa Thompson", overallRating: 4.6, difficultyRating: 2.5, workloadRating: 3.2, totalReviews: 245, wouldRecommend: 95, gradeDistribution: { "A+": 22, "A": 32, "A-": 22, "B+": 15, "B": 6, "B-": 2, "C+": 1, "C": 0, "C-": 0, "D": 0, "F": 0 }, topTags: ["Engaging", "Thoughtful", "Discussion-Based"], prerequisites: ["ENG 101"], description: "American literature from the early 20th century to present day.", semester: "Fall 2026", enrolled: 42, capacity: 45, schedule: "MWF 11:00-11:50", location: "Humanities 112" },
];

const reviews: CourseReview[] = [
  { id: "rv1", courseId: "c1", professorId: "p1", author: "Alex M.", semester: "Spring 2026", rating: 5, difficulty: 4, workload: 4, grade: "A", wouldRecommend: true, tags: ["Clear Lecturer", "Fair Grading", "Practical"], pros: ["Excellent explanations of complex topics", "Fair and transparent grading", "Useful coding assignments"], cons: ["Pace can be fast at times", "Some assignments are time-consuming"], comment: "One of the best CS professors I've had. Makes algorithms fun and understandable.", helpfulCount: 45, unhelpfulCount: 3, isAnonymous: false, date: "May 2026" },
  { id: "rv2", courseId: "c1", professorId: "p1", author: "Anonymous", semester: "Fall 2025", rating: 4, difficulty: 4, workload: 5, grade: "B+", wouldRecommend: true, tags: ["Challenging", "Fair", "Engaging"], pros: ["Great real-world examples", "Responsive on Slack", "Fair exams"], cons: ["Heavy workload", "Pacing in the second half"], comment: "Solid course. Pushed me to become a much better programmer. Office hours are gold.", helpfulCount: 32, unhelpfulCount: 5, isAnonymous: true, date: "Dec 2025" },
  { id: "rv3", courseId: "c2", professorId: "p2", author: "Jamie L.", semester: "Spring 2026", rating: 4, difficulty: 4, workload: 3, grade: "A-", wouldRecommend: true, tags: ["Expert", "Challenging", "Fair"], pros: ["Deep understanding of the subject", "Real-world applications", "Fair exams"], cons: ["Could explain better sometimes", "Homework is dense"], comment: "Wilson knows his stuff. You'll work hard but learn a lot.", helpfulCount: 28, unhelpfulCount: 4, isAnonymous: false, date: "May 2026" },
  { id: "rv4", courseId: "c3", professorId: "p3", author: "Sam R.", semester: "Fall 2025", rating: 5, difficulty: 3, workload: 3, grade: "A", wouldRecommend: true, tags: ["Passionate", "Clear", "Helpful"], pros: ["Makes quantum mechanics accessible", "Amazing lab demonstrations", "Always available for help"], cons: ["Some exam questions are tricky", "Textbook is expensive"], comment: "Dr. Patel made me fall in love with physics. Her demonstrations are incredible.", helpfulCount: 38, unhelpfulCount: 2, isAnonymous: false, date: "Dec 2025" },
  { id: "rv5", courseId: "c4", professorId: "p4", author: "Taylor K.", semester: "Spring 2026", rating: 5, difficulty: 2, workload: 3, grade: "A+", wouldRecommend: true, tags: ["Fun", "Practical", "Inspiring"], pros: ["Real case studies from Fortune 500", "Networking events", "Engaging group projects"], cons: ["Group work quality varies", "Some readings are long"], comment: "Prof. Garcia brings marketing to life. The guest speakers are amazing.", helpfulCount: 52, unhelpfulCount: 1, isAnonymous: false, date: "May 2026" },
  { id: "rv6", courseId: "c5", professorId: "p5", author: "Chris D.", semester: "Spring 2026", rating: 3, difficulty: 5, workload: 5, grade: "B", wouldRecommend: false, tags: ["Heavy Workload", "Expert", "Unclear"], pros: ["Cutting-edge content", "Research opportunities", "Smart classmates"], cons: ["Insane workload", "Unclear assignment specs", "Limited feedback"], comment: "Learn a lot but the workload is brutal. Not for the faint of heart.", helpfulCount: 41, unhelpfulCount: 8, isAnonymous: false, date: "May 2026" },
  { id: "rv7", courseId: "c6", professorId: "p6", author: "Morgan W.", semester: "Fall 2025", rating: 5, difficulty: 2, workload: 3, grade: "A", wouldRecommend: true, tags: ["Inspiring", "Supportive", "Thoughtful"], pros: ["Passionate discussions", "Detailed essay feedback", "Inclusive classroom"], cons: ["Heavy reading list", "Essay grading can feel subjective"], comment: "Thompson made me appreciate literature in a whole new way. Highly recommend.", helpfulCount: 35, unhelpfulCount: 2, isAnonymous: false, date: "Dec 2025" },
  { id: "rv8", courseId: "c1", professorId: "p1", author: "Jordan H.", semester: "Fall 2025", rating: 5, difficulty: 3, workload: 4, grade: "A", wouldRecommend: true, tags: ["Clear Lecturer", "Engaging", "Practical"], pros: ["Fun projects", "Patient with questions", "Career-relevant content"], cons: ["Occasional tech issues", "Need more lab time"], comment: "Dr. Chen is the gold standard for CS education. Clear, engaging, practical.", helpfulCount: 29, unhelpfulCount: 1, isAnonymous: false, date: "Dec 2025" },
];

// ─── SVG Components ─────────────────────────────────────────────────────────────
const RatingStars = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={size} className={s <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
    ))}
    <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
  </div>
);

const GradeBar = ({ grade, count, max }: { grade: GradeLetter; count: number; max: number }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs font-semibold w-6 text-center" style={{ color: GRADE_COLORS[grade] }}>{grade}</span>
    <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, background: GRADE_COLORS[grade] }} />
    </div>
    <span className="text-xs text-gray-500 w-8 text-right">{count}%</span>
  </div>
);

const RatingBar = ({ label, value, max = 5, color }: { label: string; value: number; max?: number; color: string }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-gray-400 w-20">{label}</span>
    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
    <span className="text-xs text-gray-400 w-6 text-right">{value.toFixed(1)}</span>
  </div>
);

const RecommendBar = ({ pct }: { pct: number }) => (
  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
    <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${pct}%` }} />
    <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${100 - pct}%` }} />
  </div>
);

// ─── Card Components ────────────────────────────────────────────────────────────
const ProfessorCard = ({ prof, onClick }: { prof: Professor; onClick: () => void }) => (
  <button onClick={onClick} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 text-left hover:border-white/20 transition-all w-full">
    <div className="flex items-start gap-3 mb-3">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: DEPT_COLORS[prof.department] + "22" }}>{prof.avatar}</div>
      <div className="flex-1">
        <div className="text-white font-semibold text-sm">{prof.name}</div>
        <div className="text-gray-500 text-xs">{prof.title} · {DEPT_COLORS[prof.department] ? prof.department.toUpperCase() : prof.department}</div>
        <RatingStars rating={prof.overallRating} size={12} />
      </div>
      <div className="text-right">
        <div className="text-white font-bold text-lg">{prof.overallRating}</div>
        <div className="text-[10px] text-gray-600">{prof.totalReviews} reviews</div>
      </div>
    </div>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: difficultyColors[prof.difficulty] + "22", color: difficultyColors[prof.difficulty] }}>{prof.difficulty}</span>
      <span className="text-[10px] text-green-400">{prof.wouldRecommend}% recommend</span>
    </div>
    <RecommendBar pct={prof.wouldRecommend} />
    <div className="flex flex-wrap gap-1 mt-2">
      {prof.topTags.map((tag) => (
        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">{tag}</span>
      ))}
    </div>
    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-600">
      <span>{prof.numCourses} courses · {prof.numStudents} students</span>
      <ChevronRight size={12} className="text-gray-600" />
    </div>
  </button>
);

const CourseCard = ({ course, onClick }: { course: Course; onClick: () => void }) => (
  <button onClick={onClick} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 text-left hover:border-white/20 transition-all w-full">
    <div className="flex items-start justify-between mb-2">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-white">{course.code}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: DEPT_COLORS[course.department] + "22", color: DEPT_COLORS[course.department] }}>{course.credits} cr</span>
        </div>
        <div className="text-white font-semibold text-sm mt-0.5">{course.name}</div>
        <div className="text-gray-500 text-xs">{course.professorName}</div>
      </div>
      <div className="text-right">
        <div className="text-white font-bold text-lg">{course.overallRating}</div>
        <div className="text-[10px] text-gray-600">{course.totalReviews} reviews</div>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 mb-2">
      <RatingBar label="Rating" value={course.overallRating} color="#22c55e" />
      <RatingBar label="Difficulty" value={course.difficultyRating} color="#f59e0b" />
      <RatingBar label="Workload" value={course.workloadRating} color="#ef4444" />
    </div>
    <div className="flex items-center justify-between text-[10px] text-gray-600">
      <span>{course.enrolled}/{course.capacity} enrolled · {course.semester}</span>
      <span className="text-green-400">{course.wouldRecommend}% recommend</span>
    </div>
  </button>
);

const ReviewCard = ({ review }: { review: CourseReview }) => (
  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white font-bold">
          {review.isAnonymous ? "?" : review.author.charAt(0)}
        </div>
        <div>
          <div className="text-white text-sm font-medium">{review.isAnonymous ? "Anonymous" : review.author}</div>
          <div className="text-gray-600 text-[10px]">{review.semester} · {review.date}</div>
        </div>
      </div>
      <RatingStars rating={review.rating} size={12} />
    </div>
    <div className="flex items-center gap-3 mb-2 text-[10px]">
      <span className="text-yellow-400">Difficulty: {review.difficulty}/5</span>
      <span className="text-blue-400">Workload: {review.workload}/5</span>
      <span className="font-semibold" style={{ color: GRADE_COLORS[review.grade] }}>Grade: {review.grade}</span>
      {review.wouldRecommend ? <span className="text-green-400 flex items-center gap-0.5"><ThumbsUp size={8} />Recommends</span> : <span className="text-red-400 flex items-center gap-0.5"><ThumbsDown size={8} />Not recommended</span>}
    </div>
    <div className="flex flex-wrap gap-1 mb-2">
      {review.tags.map((tag) => (
        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400">{tag}</span>
      ))}
    </div>
    {(review.pros.length > 0 || review.cons.length > 0) && (
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        {review.pros.length > 0 && (
          <div><span className="text-green-400 font-medium text-[10px]">PROS</span>
            <ul className="text-gray-400 mt-0.5 space-y-0.5">{review.pros.map((p, i) => <li key={i} className="flex items-start gap-1"><CheckCircle size={8} className="text-green-500 mt-0.5 shrink-0" />{p}</li>)}</ul>
          </div>
        )}
        {review.cons.length > 0 && (
          <div><span className="text-red-400 font-medium text-[10px]">CONS</span>
            <ul className="text-gray-400 mt-0.5 space-y-0.5">{review.cons.map((c, i) => <li key={i} className="flex items-start gap-1"><AlertTriangle size={8} className="text-red-500 mt-0.5 shrink-0" />{c}</li>)}</ul>
          </div>
        )}
      </div>
    )}
    {review.comment && <p className="text-gray-300 text-xs leading-relaxed mb-2">{review.comment}</p>}
    <div className="flex items-center gap-3 text-[10px] text-gray-600">
      <button className="flex items-center gap-1 hover:text-green-400 transition-colors"><ThumbsUp size={10} />{review.helpfulCount}</button>
      <button className="flex items-center gap-1 hover:text-red-400 transition-colors"><ThumbsDown size={10} />{review.unhelpfulCount}</button>
    </div>
  </div>
);

// ─── Main Dashboard ─────────────────────────────────────────────────────────────
export default function CourseReviews() {
  const [activeTab, setActiveTab] = useState<"professors" | "courses" | "reviews" | "grade-distributions">("professors");
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<Department | "all">("all");
  const [reviewSort, setReviewSort] = useState<ReviewSort>("newest");

  const tabs = [
    { key: "professors" as const, label: "Professors", icon: <GraduationCap size={14} /> },
    { key: "courses" as const, label: "Courses", icon: <BookOpen size={14} /> },
    { key: "reviews" as const, label: "Reviews", icon: <MessageSquare size={14} /> },
    { key: "grade-distributions" as const, label: "Grades", icon: <BarChart3 size={14} /> },
  ];

  const filteredProfessors = useMemo(() => {
    let result = professors;
    if (deptFilter !== "all") result = result.filter((p) => p.department === deptFilter);
    if (searchQuery) result = result.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return result;
  }, [deptFilter, searchQuery]);

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (deptFilter !== "all") result = result.filter((c) => c.department === deptFilter);
    if (searchQuery) result = result.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase()));
    return result;
  }, [deptFilter, searchQuery]);

  const filteredReviews = useMemo(() => {
    let result = reviews;
    if (selectedProfessor) result = result.filter((r) => r.professorId === selectedProfessor.id);
    if (selectedCourse) result = result.filter((r) => r.courseId === selectedCourse.id);
    switch (reviewSort) {
      case "newest": result = [...result].sort((a, b) => b.helpfulCount - a.helpfulCount); break;
      case "highest": result = [...result].sort((a, b) => b.rating - a.rating); break;
      case "lowest": result = [...result].sort((a, b) => a.rating - b.rating); break;
      case "helpful": result = [...result].sort((a, b) => b.helpfulCount - a.helpfulCount); break;
    }
    return result;
  }, [selectedProfessor, selectedCourse, reviewSort]);

  const selectedProfessorCourses = selectedProfessor ? courses.filter((c) => c.professorId === selectedProfessor.id) : [];
  const selectedProfessorReviews = selectedProfessor ? reviews.filter((r) => r.professorId === selectedProfessor.id) : [];
  const selectedCourseReviews = selectedCourse ? reviews.filter((r) => r.courseId === selectedCourse.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Star size={22} className="text-purple-400" />
          </div>
          Course Reviews
        </h1>
        <p className="text-gray-500 text-sm mt-1">Professor ratings · Course reviews · Grade distributions</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><GraduationCap size={14} className="text-purple-400" />Professors</div>
          <div className="text-2xl font-bold text-white">{professors.length}</div>
          <div className="text-xs text-gray-500">{new Set(professors.map((p) => p.department)).size} departments</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><BookOpen size={14} className="text-blue-400" />Courses</div>
          <div className="text-2xl font-bold text-white">{courses.length}</div>
          <div className="text-xs text-gray-500">{courses.reduce((a, c) => a + c.enrolled, 0)} enrolled</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><MessageSquare size={14} className="text-green-400" />Reviews</div>
          <div className="text-2xl font-bold text-white">{reviews.length}</div>
          <div className="text-xs text-gray-500">{Math.round(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length * 10) / 10} avg rating</div>
        </div>
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1"><TrendingUp size={14} className="text-amber-400" />Recommend</div>
          <div className="text-2xl font-bold text-white">{Math.round(reviews.filter((r) => r.wouldRecommend).length / reviews.length * 100)}%</div>
          <div className="text-xs text-gray-500">would recommend</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === t.key ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "professors" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                placeholder="Search professor..." />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Departments</option>
              {Object.keys(DEPT_COLORS).map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Professor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProfessors.map((prof) => (
              <ProfessorCard key={prof.id} prof={prof} onClick={() => setSelectedProfessor(prof)} />
            ))}
          </div>

          {/* Professor Detail Modal */}
          {selectedProfessor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedProfessor(null)}>
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ background: DEPT_COLORS[selectedProfessor.department] + "22" }}>{selectedProfessor.avatar}</div>
                  <div>
                    <div className="text-white font-bold text-xl">{selectedProfessor.name}</div>
                    <div className="text-gray-400 text-sm">{selectedProfessor.title} · {selectedProfessor.department.toUpperCase()}</div>
                    <RatingStars rating={selectedProfessor.overallRating} size={14} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Rating", value: selectedProfessor.overallRating.toFixed(1), color: "#22c55e" },
                    { label: "Difficulty", value: selectedProfessor.difficulty, color: difficultyColors[selectedProfessor.difficulty] },
                    { label: "Recommend", value: `${selectedProfessor.wouldRecommend}%`, color: "#3b82f6" },
                    { label: "Students", value: String(selectedProfessor.numStudents), color: "#a855f7" },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center bg-white/5 rounded-xl p-3">
                      <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-[10px] text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
                    <div className="text-green-400 font-semibold text-xs mb-2">✅ Strengths</div>
                    <ul className="space-y-1">{selectedProfessor.strengths.map((s, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1"><CheckCircle size={10} className="text-green-500 mt-0.5 shrink-0" />{s}</li>)}</ul>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                    <div className="text-red-400 font-semibold text-xs mb-2">⚠️ Areas for Improvement</div>
                    <ul className="space-y-1">{selectedProfessor.weaknesses.map((w, i) => <li key={i} className="text-gray-300 text-xs flex items-start gap-1"><AlertTriangle size={10} className="text-red-500 mt-0.5 shrink-0" />{w}</li>)}</ul>
                  </div>
                </div>

                {/* Rating Trend */}
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <div className="text-white font-semibold text-xs mb-2">Rating Trend</div>
                  <div className="flex items-end gap-2 h-16">
                    {selectedProfessor.ratingHistory.map((h) => (
                      <div key={h.semester} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[9px] text-gray-400">{h.rating}</span>
                        <div className="w-full bg-purple-500/30 rounded-t" style={{ height: `${(h.rating / 5) * 48}px` }} />
                        <span className="text-[8px] text-gray-600">{h.semester.split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Courses by this Professor */}
                <div className="mb-4">
                  <div className="text-white font-semibold text-xs mb-2">Courses ({selectedProfessorCourses.length})</div>
                  <div className="space-y-2">
                    {selectedProfessorCourses.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-all cursor-pointer" onClick={() => { setSelectedCourse(c); setActiveTab("courses"); setSelectedProfessor(null); }}>
                        <div><span className="text-xs font-mono text-white">{c.code}</span> <span className="text-xs text-gray-400">{c.name}</span></div>
                        <span className="text-xs text-yellow-400">{c.overallRating}★</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setActiveTab("reviews"); setSelectedProfessor(selectedProfessor); }} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-all">
                    <MessageSquare size={12} />View Reviews ({selectedProfessorReviews.length})
                  </button>
                  <button onClick={() => setSelectedProfessor(null)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs font-medium hover:bg-white/10 transition-all">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "courses" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                placeholder="Search course or code..." />
            </div>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
              <option value="all">All Departments</option>
              {Object.keys(DEPT_COLORS).map((d) => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCourses.map((course) => (
              <CourseCard key={course.id} course={course} onClick={() => setSelectedCourse(course)} />
            ))}
          </div>

          {/* Course Detail Modal */}
          {selectedCourse && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedCourse(null)}>
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-white">{selectedCourse.code}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: DEPT_COLORS[selectedCourse.department] + "22", color: DEPT_COLORS[selectedCourse.department] }}>{selectedCourse.department.toUpperCase()}</span>
                    </div>
                    <div className="text-white font-bold text-lg">{selectedCourse.name}</div>
                    <div className="text-gray-400 text-sm">{selectedCourse.professorName} · {selectedCourse.credits} credits</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold text-2xl">{selectedCourse.overallRating}</div>
                    <RatingStars rating={selectedCourse.overallRating} size={10} />
                  </div>
                </div>

                <p className="text-gray-400 text-xs mb-4">{selectedCourse.description}</p>

                {/* Course Info */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Schedule", value: selectedCourse.schedule, icon: <Clock size={12} /> },
                    { label: "Location", value: selectedCourse.location, icon: <Target size={12} /> },
                    { label: "Enrolled", value: `${selectedCourse.enrolled}/${selectedCourse.capacity}`, icon: <Users size={12} /> },
                  ].map((info) => (
                    <div key={info.label} className="bg-white/5 rounded-xl p-3 text-center">
                      <div className="text-gray-400 flex items-center justify-center gap-1 mb-1">{info.icon}<span className="text-[10px]">{info.label}</span></div>
                      <div className="text-white text-xs font-medium">{info.value}</div>
                    </div>
                  ))}
                </div>

                {/* Ratings */}
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <RatingBar label="Overall" value={selectedCourse.overallRating} color="#22c55e" />
                  <RatingBar label="Difficulty" value={selectedCourse.difficultyRating} color="#f59e0b" />
                  <RatingBar label="Workload" value={selectedCourse.workloadRating} color="#ef4444" />
                </div>

                {/* Grade Distribution */}
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <div className="text-white font-semibold text-xs mb-2">Grade Distribution</div>
                  <div className="space-y-1">
                    {(Object.entries(selectedCourse.gradeDistribution) as [GradeLetter, number][]).map(([grade, pct]) => (
                      pct > 0 && <GradeBar key={grade} grade={grade} count={pct} max={Math.max(...Object.values(selectedCourse.gradeDistribution))} />
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-4">
                  {selectedCourse.topTags.map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">#{tag}</span>
                  ))}
                </div>

                {/* Prerequisites */}
                {selectedCourse.prerequisites.length > 0 && (
                  <div className="text-xs text-gray-500 mb-4">
                    <span className="text-gray-400">Prerequisites: </span>
                    {selectedCourse.prerequisites.join(", ")}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => { setActiveTab("reviews"); setSelectedCourse(selectedCourse); }} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-all">
                    <MessageSquare size={12} />View Reviews ({selectedCourseReviews.length})
                  </button>
                  <button onClick={() => setSelectedCourse(null)} className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white/5 text-gray-400 border border-white/10 rounded-lg text-xs font-medium hover:bg-white/10 transition-all">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reviews" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">{filteredReviews.length} reviews{(selectedProfessor || selectedCourse) ? " (filtered)" : ""}</div>
            <div className="flex items-center gap-2">
              {(selectedProfessor || selectedCourse) && (
                <button onClick={() => { setSelectedProfessor(null); setSelectedCourse(null); }} className="text-xs text-purple-400 hover:text-purple-300">Clear filters</button>
              )}
              <select value={reviewSort} onChange={(e) => setReviewSort(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
                <option value="newest">Newest</option>
                <option value="highest">Highest Rated</option>
                <option value="lowest">Lowest Rated</option>
                <option value="helpful">Most Helpful</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredReviews.map((review) => <ReviewCard key={review.id} review={review} />)}
          </div>
        </div>
      )}

      {activeTab === "grade-distributions" && (
        <div className="space-y-4">
          <div className="text-xs text-gray-500">Grade distributions for all courses</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => (
              <div key={course.id} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-white">{course.code}</span>
                    <span className="text-xs text-gray-400 ml-2">{course.name}</span>
                  </div>
                  <span className="text-xs text-yellow-400">{course.overallRating}★</span>
                </div>
                <div className="space-y-1">
                  {(Object.entries(course.gradeDistribution) as [GradeLetter, number][]).map(([grade, pct]) => (
                    pct > 0 && <GradeBar key={grade} grade={grade} count={pct} max={Math.max(...Object.values(course.gradeDistribution))} />
                  ))}
                </div>
                <div className="text-[10px] text-gray-600 mt-2">{course.totalReviews} reviews · {course.professorName}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
