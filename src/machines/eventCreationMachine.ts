import { setup, assign } from "xstate";
import { EventContext, EventMachineEvents } from "./eventMachine.types";
import {
  validateBasics,
  validateTicketing,
  validateLocation,
  isFormFullyValid,
} from "../utils/validation";
import { submitEvent } from "./services";

const initialContext: EventContext = {
  formData: {
    title: "",
    description: "",
    category: "",
    isPaid: false,
    startDate: "",
    endDate: "",
    tags: [],
  },
  validationErrors: {},
  currentStep: 0,
};

export const eventCreationMachine = setup({
  types: {
    context: {} as EventContext,
    events: {} as EventMachineEvents,
  },
  guards: {
    isBasicsValid: ({ context }) => {
      const errors = validateBasics(context.formData);
      return Object.keys(errors).length === 0;
    },
    isTicketingValid: ({ context }) => {
      if (!context.formData.isPaid) return true;
      const errors = validateTicketing(context.formData);
      return Object.keys(errors).length === 0;
    },
    isLocationValid: ({ context }) => {
      const errors = validateLocation(context.formData);
      return Object.keys(errors).length === 0;
    },
    isPaidEvent: ({ context }) => context.formData.isPaid === true,
    isFreeEvent: ({ context }) => context.formData.isPaid === false,
    canSubmit: ({ context }) => isFormFullyValid(context.formData),
  },
  actions: {
    updateForm: assign({
      formData: ({ context, event }) => {
        if (event.type === "UPDATE_FORM") {
          return { ...context.formData, ...event.payload };
        }
        return context.formData;
      },
    }),
    updateValidationErrors: assign({
      validationErrors: ({ context, event }) => {
        // Automatically run validations based on the current context state
        // but this depends on which step we are on, so we could just return {} for now
        // and let the UI handle local validation before dispatching NEXT.
        return {};
      },
    }),
    restoreContext: assign(({ event }) => {
      if (event.type === "RESTORE") {
        return event.context;
      }
      return {};
    }),
    setValidationErrors: assign({
      validationErrors: ({ context }, params: { errors: Record<string, string> }) => params.errors,
    }),
    clearValidationErrors: assign({
      validationErrors: () => ({}),
    }),
    resetContext: assign(() => initialContext),
  },
  actors: {
    submitEvent,
  },
}).createMachine({
  id: "eventWizard",
  initial: "basics",
  context: initialContext,
  on: {
    RESTORE: {
      actions: "restoreContext",
    },
    UPDATE_FORM: {
      actions: "updateForm",
    },
    RESET: {
      target: ".basics",
      actions: "resetContext",
    },
  },
  states: {
    basics: {
      on: {
        NEXT: [
          {
            target: "ticketing",
            guard: "isBasicsValid",
          },
          {
            actions: assign({
              validationErrors: ({ context }) => validateBasics(context.formData),
            }),
          },
        ],
      },
    },
    ticketing: {
      // Auto-skip if free event.
      // XState v5 allows an always transition to check immediately.
      always: {
        target: "location",
        guard: "isFreeEvent",
      },
      on: {
        NEXT: [
          {
            target: "location",
            guard: "isTicketingValid",
          },
          {
            actions: assign({
              validationErrors: ({ context }) => validateTicketing(context.formData),
            }),
          },
        ],
        BACK: { target: "basics" },
      },
    },
    location: {
      on: {
        NEXT: [
          {
            target: "review",
            guard: "isLocationValid",
          },
          {
            actions: assign({
              validationErrors: ({ context }) => validateLocation(context.formData),
            }),
          },
        ],
        BACK: [
          {
            target: "ticketing",
            guard: "isPaidEvent",
          },
          {
            target: "basics",
            guard: "isFreeEvent",
          },
        ],
      },
    },
    review: {
      on: {
        SUBMIT: {
          target: "submitting",
          guard: "canSubmit",
        },
        BACK: { target: "location" },
      },
    },
    submitting: {
      invoke: {
        src: "submitEvent",
        input: ({ context }) => context.formData,
        onDone: {
          target: "success",
        },
        onError: {
          target: "error",
        },
      },
    },
    success: {
      type: "final",
    },
    error: {
      on: {
        RETRY: { target: "submitting" },
        BACK: { target: "review" },
      },
    },
  },
});
