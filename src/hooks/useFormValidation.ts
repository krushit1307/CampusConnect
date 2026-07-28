import { useState, useCallback, useRef, ChangeEvent, FormEvent } from "react";
import { z } from "zod";

export interface UseFormValidationOptions<TValues> {
  initialValues: TValues;
  validationSchema: z.ZodType<TValues>;
  onSubmit: (values: TValues) => void | Promise<void>;
}

export function useFormValidation<TValues extends Record<string, unknown>>({
  initialValues,
  validationSchema,
  onSubmit,
}: UseFormValidationOptions<TValues>) {
  const [values, setValues] = useState<TValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof TValues, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof TValues, boolean>>>({});

  // Use a ref for touched state to avoid stale closures in handleChange without causing re-renders
  const touchedRef = useRef(touched);
  touchedRef.current = touched;

  const validate = useCallback(
    (formValues: TValues): boolean => {
      const result = validationSchema.safeParse(formValues);
      if (result.success) {
        setErrors({});
        return true;
      }

      const fieldErrors: Partial<Record<keyof TValues, string>> = {};
      for (const error of result.error.errors) {
        const path = error.path[0] as keyof TValues;
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = error.message;
        }
      }
      setErrors(fieldErrors);
      return false;
    },
    [validationSchema],
  );

  const handleChange = useCallback(
    (
      eOrName:
        ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | keyof TValues,
      customValue?: unknown,
    ) => {
      let name: keyof TValues;
      let value: unknown;

      if (typeof eOrName === "object" && eOrName !== null && "target" in eOrName) {
        const target = eOrName.target;
        name = target.name as keyof TValues;
        value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
      } else {
        name = eOrName as keyof TValues;
        value = customValue;
      }

      setValues((prev) => {
        const newValues = { ...prev, [name]: value } as TValues;

        const result = validationSchema.safeParse(newValues);
        if (result.success) {
          setErrors({});
        } else {
          const fieldErrors: Partial<Record<keyof TValues, string>> = {};
          for (const error of result.error.errors) {
            const path = error.path[0] as keyof TValues;
            if (path && !fieldErrors[path]) {
              fieldErrors[path] = error.message;
            }
          }

          setErrors((prevErrors) => {
            const newErrors = { ...prevErrors };

            // If the field is now valid, remove its error
            if (newErrors[name] && !fieldErrors[name]) {
              delete newErrors[name];
            }
            // Only populate error if it was already touched
            else if (touchedRef.current[name] && fieldErrors[name]) {
              newErrors[name] = fieldErrors[name];
            }

            return newErrors;
          });
        }

        return newValues;
      });
    },
    [validationSchema],
  );

  const handleBlur = useCallback(
    (
      eOrName:
        ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | keyof TValues,
    ) => {
      let name: keyof TValues;

      if (typeof eOrName === "object" && eOrName !== null && "target" in eOrName) {
        name = eOrName.target.name as keyof TValues;
      } else {
        name = eOrName as keyof TValues;
      }

      setTouched((prev) => ({ ...prev, [name]: true }));

      // Validate the specific field on blur
      setValues((currentValues) => {
        const result = validationSchema.safeParse(currentValues);
        if (!result.success) {
          const fieldErrors: Partial<Record<keyof TValues, string>> = {};
          for (const error of result.error.errors) {
            const path = error.path[0] as keyof TValues;
            if (path && !fieldErrors[path]) {
              fieldErrors[path] = error.message;
            }
          }

          if (fieldErrors[name]) {
            setErrors((prev) => ({
              ...prev,
              [name]: fieldErrors[name],
            }));
          }
        }
        return currentValues;
      });
    },
    [validationSchema],
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      if (e && e.preventDefault) {
        e.preventDefault();
      }

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => {
          acc[key as keyof TValues] = true;
          return acc;
        },
        {} as Partial<Record<keyof TValues, boolean>>,
      );

      setTouched(allTouched);

      if (validate(values)) {
        await onSubmit(values);
      }
    },
    [values, onSubmit, validate],
  );

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValues,
  };
}
