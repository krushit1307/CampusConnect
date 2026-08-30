import React from "react";
import { useMachine } from "@xstate/react";
import { checkoutMachine } from "./checkoutMachine";

export const Checkout: React.FC = () => {
  const [state, send] = useMachine(checkoutMachine, {
    services: {
      reserveSeatService: async () => {
        // Mock API call to reserve seat
        return new Promise((resolve) => {
          setTimeout(() => resolve({ seatId: "seat-123" }), 1000);
        });
      },
      processPaymentService: async () => {
        // Mock Stripe API call
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            // Simulate random failure or success
            if (Math.random() > 0.5) resolve(true);
            else reject(new Error("Payment failed due to insufficient funds"));
          }, 1500);
        });
      },
      releaseSeatService: async () => {
        // Mock API call to release seat on timeout
        return new Promise((resolve) => setTimeout(resolve, 500));
      },
    },
    actions: {
      confirmDatabase: () => {
        console.log("Database updated: Payment confirmed");
      },
      sendConfirmationEmail: () => {
        console.log("Confirmation email sent to user");
      },
    },
  });

  const isReserving = state.matches("reservingSeat");
  const isAwaitingPayment = state.matches("awaitingPayment");
  const isProcessing = state.matches("processing");
  const isSuccess = state.matches("success");
  const isFailed = state.matches("failed");
  const isIdle = state.matches("idle");
  const isTimeout = state.matches("timeout");

  if (isSuccess) {
    return (
      <div className="p-6 bg-green-50 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
        <p className="text-gray-700">
          Your seat has been securely reserved. Check your email for confirmation.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-md max-w-md mx-auto mt-10">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Event Checkout</h2>

      {state.context.error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">
          {state.context.error}
        </div>
      )}

      {isIdle && (
        <button
          onClick={() => send("RESERVE_SEAT")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition"
        >
          Reserve Seat & Checkout
        </button>
      )}

      {isReserving && (
        <div className="flex items-center justify-center space-x-2 text-blue-600">
          <div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Locking your seat...</span>
        </div>
      )}

      {isAwaitingPayment && (
        <div className="space-y-4">
          <p className="text-gray-600">
            Seat reserved (ID: {state.context.seatId}). You have 15 minutes to complete payment.
          </p>
          <button
            onClick={() => send("SUBMIT_PAYMENT")}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition"
          >
            Pay with Stripe
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center space-x-2 text-blue-600">
          <div className="animate-spin h-5 w-5 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Processing secure payment...</span>
        </div>
      )}

      {isFailed && (
        <div className="space-y-4">
          <p className="text-red-600 font-semibold">Payment failed. Your seat is still reserved.</p>
          <button
            onClick={() => send("RETRY")}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded transition"
          >
            Retry Checkout
          </button>
        </div>
      )}

      {isTimeout && (
        <div className="flex items-center justify-center space-x-2 text-gray-600">
          <div className="animate-spin h-5 w-5 border-4 border-gray-400 border-t-transparent rounded-full"></div>
          <span>Releasing seat...</span>
        </div>
      )}
    </div>
  );
};

export default Checkout;
