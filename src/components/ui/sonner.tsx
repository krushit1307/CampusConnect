import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast neu-border font-mono bg-white text-black !rounded-none transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]",
          description: "group-[.toast]:text-gray-700",
          actionButton:
            "neu-border bg-black text-white hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
          cancelButton:
            "neu-border bg-gray-200 text-black hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform",
          error:
            "neu-border !bg-peach text-black !rounded-none font-bold transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]",
          success:
            "neu-border !bg-lime text-black !rounded-none font-bold transition-transform hover:translate-x-[-2px] hover:translate-y-[-2px]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
