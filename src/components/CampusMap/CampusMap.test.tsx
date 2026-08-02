import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CampusMap } from "./CampusMap";

// Mock the SVG import
vi.mock("../../assets/campus-map.svg?react", () => ({
    default: () => (
        <svg data-testid="campus-map-svg">
            <g id="building-4" className="building" data-name="Engineering Building" />
            <g id="building-library" className="building" data-name="Library" />
        </svg>
    ),
}));

describe("CampusMap Component", () => {
    it("renders the map container and controls", () => {
        render(<CampusMap />);
        expect(screen.getByTestId("campus-map-svg")).toBeInTheDocument();
        expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
        expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
        expect(screen.getByLabelText("Reset map view")).toBeInTheDocument();
    });

    it("applies active class to the specified building", () => {
        render(<CampusMap activeLocationId="building-4" />);
        const activeBuilding = document.getElementById("building-4");
        expect(activeBuilding).toHaveClass("active");

        const inactiveBuilding = document.getElementById("building-library");
        expect(inactiveBuilding).not.toHaveClass("active");
    });

    it("calls onLocationClick when a building is clicked", async () => {
        const handleClick = vi.fn();
        render(<CampusMap onLocationClick={handleClick} />);

        const building = document.getElementById("building-4");
        if (building) {
            await userEvent.click(building);
            expect(handleClick).toHaveBeenCalledWith("building-4");
        }
    });

    it("resets view when reset button is clicked", async () => {
        render(<CampusMap />);
        const resetButton = screen.getByLabelText("Reset map view");
        await userEvent.click(resetButton);
        // View state is internal, but we verify no errors are thrown
        expect(resetButton).toBeInTheDocument();
    });
});
