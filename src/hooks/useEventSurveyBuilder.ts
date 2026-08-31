import { useState, useCallback, useMemo } from "react";

export type QuestionType = "rating" | "text" | "multiple_choice" | "yes_no" | "scale";

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  options?: string[]; // for multiple_choice
  min?: number; // for scale
  max?: number; // for scale
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  questions: SurveyQuestion[];
}

export interface SurveyResponse {
  id: string;
  questionId: string;
  answer: string | number;
  submittedAt: string;
  respondentName?: string;
}

export interface SurveyConfig {
  title: string;
  description: string;
  eventId: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  allowAnonymous: boolean;
  showResults: boolean;
  deadline?: string;
}

const QUESTION_TYPE_META: Record<
  QuestionType,
  { label: string; icon: string; description: string }
> = {
  rating: { label: "Star Rating", icon: "⭐", description: "1-5 star rating" },
  text: { label: "Text Response", icon: "📝", description: "Open-ended text" },
  multiple_choice: { label: "Multiple Choice", icon: "🔘", description: "Pick one option" },
  yes_no: { label: "Yes / No", icon: "✅", description: "Binary choice" },
  scale: { label: "Linear Scale", icon: "📊", description: "Number scale" },
};

const DEFAULT_TEMPLATES: SurveyTemplate[] = [
  {
    id: "post-event",
    name: "Post-Event Feedback",
    description: "Standard feedback form after an event",
    questions: [
      {
        id: "q1",
        type: "rating",
        title: "Overall satisfaction",
        description: "How would you rate the event overall?",
        required: true,
      },
      {
        id: "q2",
        type: "scale",
        title: "Content quality",
        description: "Rate the quality of content presented",
        required: true,
        min: 1,
        max: 10,
      },
      {
        id: "q3",
        type: "text",
        title: "What did you enjoy most?",
        description: "Share your favorite part",
        required: false,
      },
      {
        id: "q4",
        type: "multiple_choice",
        title: "Would you attend again?",
        description: "",
        required: true,
        options: ["Definitely", "Probably", "Not sure", "Probably not"],
      },
      {
        id: "q5",
        type: "text",
        title: "Suggestions for improvement",
        description: "Any constructive feedback?",
        required: false,
      },
    ],
  },
  {
    id: "speaker-rating",
    name: "Speaker / Presenter Rating",
    description: "Rate speakers at workshops or talks",
    questions: [
      {
        id: "q1",
        type: "rating",
        title: "Speaker knowledge",
        description: "How knowledgeable was the speaker?",
        required: true,
      },
      {
        id: "q2",
        type: "rating",
        title: "Presentation clarity",
        description: "Was the content easy to follow?",
        required: true,
      },
      {
        id: "q3",
        type: "scale",
        title: "Engagement level",
        description: "How engaging was the presentation?",
        required: true,
        min: 1,
        max: 10,
      },
      {
        id: "q4",
        type: "yes_no",
        title: "Would you recommend this speaker?",
        description: "",
        required: true,
      },
      { id: "q5", type: "text", title: "Additional comments", description: "", required: false },
    ],
  },
  {
    id: "workshop-evaluation",
    name: "Workshop Evaluation",
    description: "Detailed evaluation for hands-on workshops",
    questions: [
      {
        id: "q1",
        type: "rating",
        title: "Workshop relevance",
        description: "Was the workshop relevant to your studies/career?",
        required: true,
      },
      {
        id: "q2",
        type: "scale",
        title: "Difficulty level",
        description: "How would you rate the difficulty?",
        required: true,
        min: 1,
        max: 5,
      },
      {
        id: "q3",
        type: "multiple_choice",
        title: "Your experience level",
        description: "Before this workshop",
        required: true,
        options: ["Complete beginner", "Some experience", "Intermediate", "Advanced"],
      },
      {
        id: "q4",
        type: "yes_no",
        title: "Would you take another workshop?",
        description: "",
        required: true,
      },
      {
        id: "q5",
        type: "text",
        title: "What topics would you like to learn next?",
        description: "",
        required: false,
      },
    ],
  },
];

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateMockResponses(questions: SurveyQuestion[]): SurveyResponse[] {
  const responses: SurveyResponse[] = [];
  const respondents = [
    "Alex K.",
    "Priya S.",
    "Marcus L.",
    "Chen W.",
    "Aisha R.",
    "Tom B.",
    "Nina P.",
    "Jordan M.",
    "Fatima H.",
    "Ravi G.",
  ];

  for (const q of questions) {
    for (let i = 0; i < respondents.length; i++) {
      let answer: string | number;
      switch (q.type) {
        case "rating":
          answer = Math.floor(Math.random() * 3) + 3; // 3-5
          break;
        case "scale":
          answer = Math.floor(Math.random() * ((q.max || 10) - (q.min || 1) + 1)) + (q.min || 1);
          break;
        case "yes_no":
          answer = Math.random() > 0.2 ? "Yes" : "No";
          break;
        case "multiple_choice":
          answer = q.options?.[Math.floor(Math.random() * q.options.length)] || "Option 1";
          break;
        case "text": {
          const texts = [
            "Great event, learned a lot!",
            "Could be improved in some areas.",
            "Very informative and well-organized.",
            "Loved the interactive sessions.",
            "The venue was a bit hard to find.",
            "Excellent speaker, would attend again.",
            "More hands-on exercises would be nice.",
            "Perfect timing and duration.",
            "Good networking opportunities.",
            "Looking forward to the next one!",
          ];
          answer = texts[i % texts.length];
          break;
        }
        default:
          answer = "N/A";
      }
      responses.push({
        id: `r_${q.id}_${i}`,
        questionId: q.id,
        answer,
        submittedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        respondentName: respondents[i],
      });
    }
  }
  return responses;
}

function computeQuestionStats(questionId: string, type: QuestionType, responses: SurveyResponse[]) {
  const relevant = responses.filter((r) => r.questionId === questionId);
  if (relevant.length === 0) return null;

  const base = { total: relevant.length };

  switch (type) {
    case "rating":
    case "scale": {
      const nums = relevant.map((r) => Number(r.answer));
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const distribution: Record<string, number> = {};
      for (const n of nums) {
        const key = String(n);
        distribution[key] = (distribution[key] || 0) + 1;
      }
      return {
        ...base,
        average: Math.round(avg * 10) / 10,
        distribution,
        min: Math.min(...nums),
        max: Math.max(...nums),
      };
    }
    case "yes_no": {
      const counts = { Yes: 0, No: 0 };
      for (const r of relevant) counts[r.answer as "Yes" | "No"]++;
      return { ...base, counts, yesPercent: Math.round((counts.Yes / relevant.length) * 100) };
    }
    case "multiple_choice": {
      const counts: Record<string, number> = {};
      for (const r of relevant) counts[r.answer as string] = (counts[r.answer as string] || 0) + 1;
      return { ...base, counts };
    }
    case "text": {
      return { ...base, sampleAnswers: relevant.slice(0, 5).map((r) => String(r.answer)) };
    }
    default:
      return base;
  }
}

export function useEventSurveyBuilder(eventId?: string) {
  const [config, setConfig] = useState<SurveyConfig>({
    title: "",
    description: "",
    eventId: eventId || "",
    questions: [],
    isActive: false,
    createdAt: new Date().toISOString(),
    allowAnonymous: true,
    showResults: false,
  });

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [view, setView] = useState<"build" | "preview" | "results">("build");

  const templates = DEFAULT_TEMPLATES;

  const addQuestion = useCallback((type: QuestionType) => {
    const meta = QUESTION_TYPE_META[type];
    const newQ: SurveyQuestion = {
      id: generateId(),
      type,
      title: "",
      description: meta.description,
      required: false,
      ...(type === "multiple_choice" ? { options: ["Option 1", "Option 2"] } : {}),
      ...(type === "scale" ? { min: 1, max: 10 } : {}),
    };
    setConfig((prev) => ({ ...prev, questions: [...prev.questions, newQ] }));
  }, []);

  const updateQuestion = useCallback((id: string, update: Partial<SurveyQuestion>) => {
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...update } : q)),
    }));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== id),
    }));
  }, []);

  const duplicateQuestion = useCallback((id: string) => {
    setConfig((prev) => {
      const original = prev.questions.find((q) => q.id === id);
      if (!original) return prev;
      const copy = { ...original, id: generateId(), title: `${original.title} (copy)` };
      const idx = prev.questions.findIndex((q) => q.id === id);
      const updated = [...prev.questions];
      updated.splice(idx + 1, 0, copy);
      return { ...prev, questions: updated };
    });
  }, []);

  const moveQuestion = useCallback((id: string, direction: "up" | "down") => {
    setConfig((prev) => {
      const idx = prev.questions.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const updated = [...prev.questions];
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= updated.length) return prev;
      [updated[idx], updated[target]] = [updated[target], updated[idx]];
      return { ...prev, questions: updated };
    });
  }, []);

  const loadTemplate = useCallback((templateId: string) => {
    const tpl = DEFAULT_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setConfig((prev) => ({
        ...prev,
        title: tpl.name,
        description: tpl.description,
        questions: tpl.questions.map((q) => ({ ...q, id: generateId() })),
      }));
    }
  }, []);

  const loadMockData = useCallback(() => {
    if (config.questions.length > 0) {
      setResponses(generateMockResponses(config.questions));
    }
  }, [config.questions]);

  const stats = useMemo(() => {
    return config.questions.map((q) => ({
      question: q,
      stats: computeQuestionStats(q.id, q.type, responses),
    }));
  }, [config.questions, responses]);

  const responseCount = useMemo(() => {
    const unique = new Set(responses.map((r) => r.submittedAt));
    return unique.size;
  }, [responses]);

  return {
    config,
    setConfig,
    templates,
    addQuestion,
    updateQuestion,
    removeQuestion,
    duplicateQuestion,
    moveQuestion,
    loadTemplate,
    loadMockData,
    responses,
    stats,
    responseCount,
    view,
    setView,
    QUESTION_TYPE_META,
  };
}
