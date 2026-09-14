"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium " +
    "transition-all duration-150 ease-out active:scale-[0.97] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vera-500 focus-visible:ring-offset-2 " +
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
  const variants: Record<string, string> = {
    primary: "bg-vera-600 text-white shadow-sm hover:bg-vera-700 hover:shadow-md",
    secondary: "bg-white text-vera-700 border border-vera-300 hover:border-vera-400 hover:bg-vera-50",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md",
    ghost: "text-vera-700 hover:bg-vera-50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

const FIELD_BASE =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all duration-150 " +
  "hover:border-gray-400 focus:border-vera-500 focus:outline-none focus:ring-4 focus:ring-vera-500/15";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_BASE} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_BASE} ${props.className ?? ""}`} />;
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 ${className}`}
    >
      {children}
    </div>
  );
}

export function Alert({
  variant = "info",
  children,
}: {
  variant?: "info" | "error" | "success" | "warning";
  children: React.ReactNode;
}) {
  const variants: Record<string, string> = {
    info: "bg-blue-50 text-blue-800 border-blue-200 border-l-blue-500",
    error: "bg-red-50 text-red-800 border-red-200 border-l-red-500",
    success: "bg-green-50 text-green-800 border-green-200 border-l-green-500",
    warning: "bg-amber-50 text-amber-800 border-amber-200 border-l-amber-500",
  };
  return (
    <div
      className={`animate-fade-in-up rounded-lg border border-l-4 px-4 py-3 text-sm ${variants[variant]}`}
      role="status"
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger";
}) {
  const variants: Record<string, string> = {
    neutral: "bg-gray-100 text-gray-700 ring-gray-500/10",
    success: "bg-green-100 text-green-800 ring-green-600/10",
    warning: "bg-amber-100 text-amber-800 ring-amber-600/10",
    danger: "bg-red-100 text-red-800 ring-red-600/10",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
