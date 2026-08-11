import { describe, it, expect } from "vitest";
import {
  CustomQuestion,
  validateCustomQuestionsSchema,
  buildDynamicRsvpSchema,
  MAX_CUSTOM_QUESTIONS,
} from "./dynamicForms";

describe("Dynamic Form Builder Suite (#2670)", () => {
  const sampleQuestions: CustomQuestion[] = [
    {
      id: "q_github",
      label: "GitHub Username",
      type: "text",
      required: true,
    },
    {
      id: "q_dietary",
      label: "Dietary Preference",
      type: "multiple_choice",
      required: false,
      options: ["Vegetarian", "Vegan", "None"],
    },
    {
      id: "q_code_of_conduct",
      label: "Agree to Code of Conduct",
      type: "checkbox",
      required: true,
    },
  ];

  it("validates question schema configuration and caps at 10 questions", () => {
    expect(validateCustomQuestionsSchema(sampleQuestions)).toBe(true);

    const excessiveQuestions = Array.from({ length: 11 }, (_, i) => ({
      id: `q_${i}`,
      label: `Question ${i}`,
      type: "text" as const,
      required: false,
    }));

    expect(() => validateCustomQuestionsSchema(excessiveQuestions)).toThrow(
      `Cannot exceed maximum of ${MAX_CUSTOM_QUESTIONS} custom questions.`,
    );
  });

  it("dynamically validates valid attendee responses", () => {
    const schema = buildDynamicRsvpSchema(sampleQuestions);

    const validPayload = {
      q_github: "annukumar123",
      q_dietary: "Vegan",
      q_code_of_conduct: true,
    };

    const parsed = schema.parse(validPayload);
    expect(parsed.q_github).toBe("annukumar123");
    expect(parsed.q_code_of_conduct).toBe(true);
  });

  it("fails validation when required fields are missing or unchecked", () => {
    const schema = buildDynamicRsvpSchema(sampleQuestions);

    const invalidPayload = {
      q_github: "", // Missing required text
      q_code_of_conduct: false, // Unchecked required checkbox
    };

    const result = schema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
