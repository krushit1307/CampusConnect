import { useEffect, useState } from "react";
import { useMachine } from "@xstate/react";
import { eventCreationMachine } from "../machines/eventCreationMachine";
import { loadWizardState, saveWizardState, clearWizardState } from "../utils/sessionPersistence";
import { EventFormData } from "../machines/eventMachine.types";

export function useEventWizard() {
  // Try to load persisted state on initial render
  const [initialState] = useState(() => loadWizardState());

  // Use the machine. If we have a saved state, we could hydrate it.
  // XState v5 allows passing `state` option to useMachine for hydration,
  // but it expects a full State object. Since we only saved `stateValue` and `context`,
  // it might be simpler to start the machine normally and immediately send a RESTORE event,
  // or we can just rely on the context restoration if we can't fully serialize State.
  // For simplicity, we'll restore context via RESTORE if we have it,
  // though jumping back to the exact step requires a bit more logic in v5.

  const [snapshot, send] = useMachine(eventCreationMachine);

  // Restore on mount
  useEffect(() => {
    if (initialState) {
      send({ type: "RESTORE", context: initialState.context });
      // To strictly jump to the state, one might need a more advanced restore approach.
      // But for this demo, we'll at least restore the form data.
    }
  }, [initialState, send]);

  // Persist on change
  useEffect(() => {
    if (snapshot.value === "success") {
      clearWizardState();
    } else {
      saveWizardState(snapshot.value as string, snapshot.context);
    }
  }, [snapshot.value, snapshot.context]);

  const updateForm = (payload: Partial<EventFormData>) => {
    send({ type: "UPDATE_FORM", payload });
  };

  const next = () => send({ type: "NEXT" });
  const back = () => send({ type: "BACK" });
  const submit = () => send({ type: "SUBMIT" });
  const reset = () => {
    clearWizardState();
    send({ type: "RESET" });
  };
  const retry = () => send({ type: "RETRY" });

  return {
    stateValue: snapshot.value,
    context: snapshot.context,
    updateForm,
    next,
    back,
    submit,
    reset,
    retry,
    canSubmit: snapshot.can({ type: "SUBMIT" }),
    canNext: snapshot.can({ type: "NEXT" }),
    canBack: snapshot.can({ type: "BACK" }),
  };
}
