import { EventContext } from "../machines/eventMachine.types";

const STORAGE_KEY = "event_wizard_state";

export function saveWizardState(stateValue: string, context: EventContext) {
  try {
    const data = JSON.stringify({ stateValue, context });
    sessionStorage.setItem(STORAGE_KEY, data);
  } catch (e) {
    console.warn("Failed to save wizard state to sessionStorage", e);
  }
}

export function loadWizardState(): { stateValue: string; context: EventContext } | null {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn("Failed to parse wizard state from sessionStorage", e);
  }
  return null;
}

export function clearWizardState() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}
