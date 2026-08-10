import { EventFormData } from "../machines/eventMachine.types";

export function validateBasics(data: EventFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.title?.trim()) errors.title = "Title is required";
  if (!data.description?.trim()) errors.description = "Description is required";
  if (!data.category?.trim()) errors.category = "Category is required";
  if (!data.startDate) errors.startDate = "Start date is required";
  if (!data.endDate) errors.endDate = "End date is required";
  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    errors.endDate = "End date must be after start date";
  }
  return errors;
}

export function validateTicketing(data: EventFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (data.isPaid) {
    if (!data.price || data.price <= 0) errors.price = "Price must be greater than 0";
    if (!data.currency) errors.currency = "Currency is required";
  }
  return errors;
}

export function validateLocation(data: EventFormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!data.location?.trim()) errors.location = "Location is required";
  return errors;
}

export function isFormFullyValid(data: EventFormData): boolean {
  return (
    Object.keys(validateBasics(data)).length === 0 &&
    Object.keys(validateTicketing(data)).length === 0 &&
    Object.keys(validateLocation(data)).length === 0
  );
}
