export interface EventFormData {
  title: string;
  description: string;
  category: string;
  isPaid: boolean;
  price?: number;
  currency?: string;
  location?: string;
  startDate: string;
  endDate: string;
  tags: string[];
  image?: string;
}

export interface EventContext {
  formData: EventFormData;
  validationErrors: Record<string, string>;
  currentStep: number;
}

export type EventMachineEvents =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "UPDATE_FORM"; payload: Partial<EventFormData> }
  | { type: "SUBMIT" }
  | { type: "RESET" }
  | { type: "RETRY" }
  | { type: "RESTORE"; context: EventContext };
