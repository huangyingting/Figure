import { cn } from "@/components/ui/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-lg border border-line bg-[#fbf7ec] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-2 focus:border-pine focus:shadow-[0_0_0_3px_rgb(28_107_82_/_8%)] disabled:text-muted disabled:bg-[#f1ebdd]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-[46px] px-3 text-body", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "px-3 py-[11px] text-body resize-y", className)} {...props} />;
}
