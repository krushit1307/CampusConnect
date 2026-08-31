import { createMachine, assign } from "xstate";

export interface CheckoutContext {
  seatId: string | null;
  error: string | null;
}

export const checkoutMachine = createMachine<CheckoutContext>({
  id: "checkout",
  initial: "idle",
  context: {
    seatId: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        RESERVE_SEAT: "reservingSeat",
      },
    },
    reservingSeat: {
      invoke: {
        src: "reserveSeatService",
        onDone: {
          target: "awaitingPayment",
          actions: assign({
            seatId: (context, event) => event.data.seatId,
            error: null,
          }),
        },
        onError: {
          target: "failed",
          actions: assign({
            error: (context, event) => event.data.message,
          }),
        },
      },
    },
    awaitingPayment: {
      on: {
        SUBMIT_PAYMENT: "processing",
        TIMEOUT: "timeout",
      },
      after: {
        900000: "timeout", // 15 minutes timeout to release seat
      },
    },
    processing: {
      invoke: {
        src: "processPaymentService",
        onDone: {
          target: "success",
          actions: "confirmDatabase",
        },
        onError: {
          target: "awaitingPayment",
          actions: assign({
            error: (context, event) => event.data.message,
          }),
        },
      },
    },
    success: {
      type: "final",
      entry: "sendConfirmationEmail",
    },
    failed: {
      on: {
        RETRY: "idle",
      },
    },
    timeout: {
      invoke: {
        src: "releaseSeatService",
        onDone: {
          target: "idle",
          actions: assign({
            seatId: null,
            error: (context, event) => "Session timed out. Seat released.",
          }),
        },
      },
    },
  },
});
