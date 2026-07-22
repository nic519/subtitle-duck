import * as React from "react";

import { cn } from "@/lib/utils";

export const Button = ({
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type={type}
    data-slot="button"
    className={cn(
      "inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
);
