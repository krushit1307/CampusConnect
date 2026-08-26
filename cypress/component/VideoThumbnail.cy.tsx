import { VideoThumbnail } from "@/components/VideoThumbnail";

/**
 * Sample CT spec (issue #1851).
 *
 * Mounts <VideoThumbnail /> in a real browser so we can exercise the
 * mouseenter / mouseleave hover preview behavior — exactly the kind
 * of test that jsdom + RTL can't reliably cover because it relies on
 * pointer events firing through the real browser's hit-testing.
 *
 * Uses cy.mount() from @cypress/react, which is configured by the
 * component-mode support file.
 */
describe("<VideoThumbnail />", () => {
  const THUMB = "https://example.com/thumb.jpg";
  const PREVIEW = "https://example.com/preview.webm";

  it("renders the static thumbnail", () => {
    cy.mount(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Test recording" />);
    cy.findByAltText("Test recording").should("be.visible");
  });

  it("exposes the data-testid on the wrapper", () => {
    cy.mount(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Test recording" />);
    cy.get('[data-testid="video-thumbnail"]').should("exist");
  });

  it("renders the video preview tag with the preview URL", () => {
    cy.mount(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Test" />);
    cy.get('[data-testid="video-preview"]')
      .should("have.attr", "src", PREVIEW)
      .and("have.attr", "muted")
      .and("have.attr", "loop");
  });

  it("renders as an <a> tag when href is supplied", () => {
    cy.mount(
      <VideoThumbnail
        thumbnailUrl={THUMB}
        previewUrl={PREVIEW}
        alt="Test"
        href="/events/abc/replay"
      />,
    );
    cy.get('[data-testid="video-thumbnail"]')
      .should("have.prop", "tagName", "A")
      .and("have.attr", "href", "/events/abc/replay");
  });

  it("does NOT render the <video> tag on touch-only devices", () => {
    cy.viewport("iphone-6");
    cy.mount(<VideoThumbnail thumbnailUrl={THUMB} previewUrl={PREVIEW} alt="Test" />);
    // jsdom-friendly assertion: the data-testid must not be present
    // because useHoverCapable() returns false on coarse-pointer.
    cy.get('[data-testid="video-preview"]').should("not.exist");
  });
});
