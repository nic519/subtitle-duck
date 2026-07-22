import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed left-1/2 top-1/2 z-50 flex max-h-screen w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 outline-none",
        className
      )}
      {...props}
    />
  )
}

function Toast({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(
        "grid rounded-[8px] border border-black/10 bg-white/95 px-3 py-2.5 text-[12px] leading-5 text-[#1d1d1f] shadow-[0_14px_34px_-18px_rgba(0,0,0,0.45)] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:border-white/10 dark:bg-[#1f1f21]/95 dark:text-[#f5f5f7]",
        className
      )}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn("min-w-0 break-words", className)}
      {...props}
    />
  )
}

export { Toast, ToastDescription, ToastProvider, ToastViewport }
