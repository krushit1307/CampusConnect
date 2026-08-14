import React from "react";
import { TimelineMilestone } from "@/components/Clubs/Timeline";

/**
 * Maps a club_milestones database record to the TimelineMilestone interface.
 * Handles fuzzy date representations (year, decade, unknown).
 */
export const mapMilestoneToTimeline = (milestone: any): TimelineMilestone => {
  let displayYear: number | undefined;
  let icon: string | undefined;

  switch (milestone.date_precision) {
    case "year":
      displayYear = milestone.year;
      icon = "award";
      break;
    case "decade":
      // Display the decade as the starting year (e.g., 1980s -> 1980)
      // But only if we have a year value; otherwise use undefined
      if (milestone.year !== null && milestone.year !== undefined) {
        displayYear = Math.floor(milestone.year / 10) * 10;
      }
      icon = "calendar";
      break;
    case "unknown":
      // No year badge displayed, use a question mark icon or leave undefined
      displayYear = undefined;
      icon = "question";
      break;
  }

  return {
    id: milestone.id,
    year: displayYear ?? 0,
    title: milestone.title,
    description: milestone.description || "",
    imageUrl: milestone.image_url,
    icon,
  };
};
