import { describe, it, expect } from "vitest";
import { sanitizeToCityLevelCoordinates, clusterAlumniByCity, RawAlumniProfile } from "./alumniMap";

describe("Dynamic Alumni Network Geographic Map Suite (#3674)", () => {
  const sampleAlumni: RawAlumniProfile[] = [
    {
      userId: "alumni_1",
      fullName: "Alice Smith",
      clubId: "club_robotics",
      currentCity: "Seattle",
      latitude: 47.6062095, // High precision coordinate
      longitude: -122.3320708,
      graduationYear: 2024,
      jobTitle: "Software Engineer",
      company: "Amazon",
      isVisibleOnMap: true,
    },
    {
      userId: "alumni_2",
      fullName: "Bob Jones",
      clubId: "club_robotics",
      currentCity: "Seattle",
      latitude: 47.6080111,
      longitude: -122.3351212,
      graduationYear: 2025,
      jobTitle: "Robotics Engineer",
      company: "Boeing",
      isVisibleOnMap: true,
    },
    {
      userId: "alumni_3",
      fullName: "Charlie Brown",
      clubId: "club_robotics",
      currentCity: "Seattle",
      latitude: 47.6011111,
      longitude: -122.3311111,
      graduationYear: 2023,
      jobTitle: "Data Scientist",
      company: "Microsoft",
      isVisibleOnMap: false, // Opted out of map display
    },
    {
      userId: "alumni_4",
      fullName: "Diana Prince",
      clubId: "club_chess", // Different club
      currentCity: "Austin",
      latitude: 30.267153,
      longitude: -97.7430608,
      graduationYear: 2024,
      jobTitle: "Product Manager",
      company: "Dell",
      isVisibleOnMap: true,
    },
  ];

  it("truncates coordinates to city-level precision to enforce privacy", () => {
    const coords = sanitizeToCityLevelCoordinates(47.6062095, -122.3320708);
    expect(coords.lat).toBe(47.61);
    expect(coords.lng).toBe(-122.33);
  });

  it("clusters opted-in alumni by city and respects club filter", () => {
    const roboticsSeattle = clusterAlumniByCity(sampleAlumni, "club_robotics");

    expect(roboticsSeattle.length).toBe(1); // Only Seattle cluster
    expect(roboticsSeattle[0].cityName).toBe("Seattle");
    expect(roboticsSeattle[0].alumniCount).toBe(2); // Alice & Bob (Charlie opted out)
    expect(roboticsSeattle[0].alumniList.map((a) => a.fullName)).toEqual([
      "Alice Smith",
      "Bob Jones",
    ]);
  });
  it("includes all opted-in alumni when no club filter is specified", () => {
    const allCities = clusterAlumniByCity(sampleAlumni);

    expect(allCities.length).toBe(2); // Seattle and Austin
    const austin = allCities.find((c) => c.cityName === "Austin");
    expect(austin?.alumniCount).toBe(1);
    expect(austin?.alumniList[0].fullName).toBe("Diana Prince");
  });
});
