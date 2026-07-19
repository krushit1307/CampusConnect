import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast neu-border font-mono bg-white text-black",
          description: "group-[.toast]:text-gray-700",
          actionButton: "neu-border bg-black text-white",
          cancelButton: "neu-border bg-gray-200 text-black",
          error: "!bg-peach text-black",
          success: "!bg-lime text-black",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
