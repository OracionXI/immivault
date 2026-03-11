"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        duration: 5000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:py-4 group-[.toaster]:px-4",
          title: "group-[.toast]:text-sm group-[.toast]:font-semibold group-[.toast]:leading-snug",
          description: "group-[.toast]:text-xs group-[.toast]:text-muted-foreground group-[.toast]:leading-relaxed group-[.toast]:mt-0.5",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          closeButton:
            "group-[.toast]:border-border group-[.toast]:bg-background group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-destructive",
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-emerald-500",
          info:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-blue-500",
          warning:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-amber-500",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
