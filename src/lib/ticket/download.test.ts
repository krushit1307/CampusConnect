import { describe, it, expect } from "vitest";
import { buildTicketFilename } from "./download";

describe("buildTicketFilename (issue #1913)", () => {
  it("slugifies a normal event title", () => {
    expect(
      buildTicketFilename({
        event: { title: "Campus Hackathon 2026" },
        attendee: {},
        ticketId: "AB12CD",
      }),
    ).toBe("ticket-AB12CD-campus-hackathon-2026.pdf");
  });

  it("collapses runs of non-alphanumerics into single hyphens", () => {
    expect(
      buildTicketFilename({
        event: { title: "AI / ML — Workshop!!" },
        attendee: {},
        ticketId: "X1Y2Z3",
      }),
    ).toBe("ticket-X1Y2Z3-ai-ml-workshop.pdf");
  });

  it("strips leading and trailing hyphens", () => {
    expect(
      buildTicketFilename({
        event: { title: "!!!Hello World!!!" },
        attendee: {},
        ticketId: "TT",
      }),
    ).toBe("ticket-TT-hello-world.pdf");
  });

  it("caps slug length at 60 chars", () => {
    const long = "a".repeat(200);
    const out = buildTicketFilename({
      event: { title: long },
      attendee: {},
      ticketId: "ID",
    });
    // ticket-ID- + 60 a's + .pdf
    expect(out).toBe(`ticket-ID-${"a".repeat(60)}.pdf`);
  });

  it("falls back to ticket-<id>.pdf when the title is empty", () => {
    expect(
      buildTicketFilename({
        event: { title: "" },
        attendee: {},
        ticketId: "AB12CD",
      }),
    ).toBe("ticket-AB12CD.pdf");
  });

  it("falls back when the title is only punctuation", () => {
    expect(
      buildTicketFilename({
        event: { title: "!!! --- ????" },
        attendee: {},
        ticketId: "AB12CD",
      }),
    ).toBe("ticket-AB12CD.pdf");
  });

  it("preserves digits inside the title", () => {
    expect(
      buildTicketFilename({
        event: { title: "React 19 Deep Dive" },
        attendee: {},
        ticketId: "R19",
      }),
    ).toBe("ticket-R19-react-19-deep-dive.pdf");
  });
});
