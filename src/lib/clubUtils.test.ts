import { describe, expect, it } from "vitest";
import { clubFormSchema } from "./clubUtils";

describe("clubFormSchema validation", () => {
  it("validates a club with a valid github_repo_url", () => {
    const validData = {
      name: "Open Source Club",
      slug: "open-source-club",
      description: "A club dedicated to open source software.",
      github_repo_url: "https://github.com/campus-connect/open-source-club",
    };

    const result = clubFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("validates a club without github_repo_url", () => {
    const validData = {
      name: "Music Club",
      slug: "music-club",
      description: "Music lovers unite.",
    };

    const result = clubFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("validates a club with empty string github_repo_url and transforms it to null", () => {
    const validData = {
      name: "Art Club",
      slug: "art-club",
      description: "Creative art and design.",
      github_repo_url: "",
    };

    const result = clubFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.github_repo_url).toBeNull();
    }
  });

  it("rejects github_repo_url that does not start with https://github.com/", () => {
    const invalidData = {
      name: "Tech Club",
      slug: "tech-club",
      description: "Technology and coding.",
      github_repo_url: "http://github.com/campus-connect/tech-club",
    };

    const result = clubFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "GitHub repository URL must start with https://github.com/",
      );
    }
  });

  it("rejects invalid non-github domain URLs", () => {
    const invalidData = {
      name: "Dev Club",
      slug: "dev-club",
      description: "Software engineering.",
      github_repo_url: "https://gitlab.com/campus-connect/dev-club",
    };

    const result = clubFormSchema.safeParse(invalidData);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "GitHub repository URL must start with https://github.com/",
      );
    }
  });

  it("defaults club visibility to public when omitted", () => {
    const validData = {
      name: "Honor Society",
      slug: "honor-society",
      description: "Academic excellence.",
    };

    const result = clubFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe("public");
    }
  });

  it("validates private club visibility", () => {
    const validData = {
      name: "Secret Society",
      slug: "secret-society",
      description: "Private invite only club.",
      visibility: "private",
    };

    const result = clubFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe("private");
    }
  });
});
