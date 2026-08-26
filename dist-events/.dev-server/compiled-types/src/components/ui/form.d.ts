import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form";
declare const Form: <
  TFieldValues extends FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>({
  children,
  watch,
  getValues,
  getFieldState,
  setError,
  clearErrors,
  setValue,
  setValues,
  trigger,
  formState,
  resetField,
  reset,
  handleSubmit,
  unregister,
  control,
  register,
  setFocus,
  subscribe,
}: import("react-hook-form").FormProviderProps<
  TFieldValues,
  TContext,
  TTransformedValues
>) => React.JSX.Element;
declare const FormField: <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => React.JSX.Element;
declare const useFormField: () => {
  invalid: boolean;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
  error?: import("react-hook-form").FieldError;
  id: string;
  name: string;
  formItemId: string;
  formDescriptionId: string;
  formMessageId: string;
};
declare const FormItem: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>
>;
declare const FormLabel: React.ForwardRefExoticComponent<
  Omit<LabelPrimitive.LabelProps & React.RefAttributes<HTMLLabelElement>, "ref"> & {
    required?: boolean;
  } & React.RefAttributes<HTMLLabelElement>
>;
declare const FormControl: React.ForwardRefExoticComponent<
  Omit<
    React.HTMLAttributes<HTMLElement> & {
      children?: React.ReactNode;
    } & React.RefAttributes<HTMLElement>,
    "ref"
  > &
    React.RefAttributes<HTMLElement>
>;
declare const FormDescription: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>
>;
declare const FormMessage: React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLParagraphElement> & React.RefAttributes<HTMLParagraphElement>
>;
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
};
