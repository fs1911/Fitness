import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium select-none transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-strong",
        secondary: "bg-surface-2 text-foreground border border-border hover:bg-[#252b34]",
        ghost: "text-foreground hover:bg-surface-2",
        outline: "border border-border text-foreground hover:bg-surface-2",
        danger: "bg-danger text-danger-foreground hover:opacity-90",
        "danger-outline": "border border-danger/60 text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-10 px-3 text-sm [&_svg]:size-4",
        md: "h-12 px-4 text-base [&_svg]:size-5",
        lg: "h-14 px-5 text-lg [&_svg]:size-6",
        icon: "size-12 [&_svg]:size-5",
        "icon-sm": "size-10 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
