import { customFetch } from "../utils/fetch";
import { ENDPOINTS } from "./api";

// We set isStaticMetadata to true to ensure aggressive caching headers are respected
// and no cache-busting timestamp queries are appended.

export async function fetchMajors() {
  return customFetch(ENDPOINTS.MAJORS, { isStaticMetadata: true });
}

export async function fetchSemesters() {
  return customFetch(ENDPOINTS.SEMESTERS, { isStaticMetadata: true });
}

export async function fetchTerms() {
  return customFetch(ENDPOINTS.TERMS, { isStaticMetadata: true });
}

export async function fetchDepartments() {
  return customFetch(ENDPOINTS.DEPARTMENTS, { isStaticMetadata: true });
}
