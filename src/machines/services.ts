import { EventFormData } from "./eventMachine.types";

export const submitEvent = async ({ input }: { input: EventFormData }) => {
  // Mock API call for now since we don't have a real backend endpoint yet
  // In reality, this would be a fetch/axios call or Supabase client call
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (input.title === "fail") {
        reject(new Error("Simulated submission failure"));
      } else {
        resolve({ success: true, eventId: "evt_123" });
      }
    }, 1500);
  });
};
