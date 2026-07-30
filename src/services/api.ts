export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const ENDPOINTS = {
  MAJORS: `${API_BASE_URL}/majors`,
  SEMESTERS: `${API_BASE_URL}/semesters`,
  TERMS: `${API_BASE_URL}/terms`,
  DEPARTMENTS: `${API_BASE_URL}/departments`,
  PROFILE: `${API_BASE_URL}/profile`,
  NOTIFICATIONS: `${API_BASE_URL}/notifications`,
};
