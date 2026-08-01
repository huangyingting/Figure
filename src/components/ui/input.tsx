import { cn } from "@/components/ui/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldBase =
  "w-full rounded-lg border border-line bg-[#faf9f6] text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-2 focus:border-violet focus:shadow-[0_0_0_3px_rgb(101_87_232_/_8%)] disabled:text-muted disabled:bg-[#f2f1ed]";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-[46px] px-3 text-body", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "px-3 py-[11px] text-body resize-y", className)} {...props} />;
}
