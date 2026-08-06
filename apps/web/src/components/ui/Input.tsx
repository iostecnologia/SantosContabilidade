import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

interface FieldProps {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, FieldProps & InputHTMLAttributes<HTMLInputElement>>(
  ({ label, error, className = "", ...props }, ref) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        ref={ref}
        className={`rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  ),
);
Input.displayName = "Input";

export const Select = forwardRef<
  HTMLSelectElement,
  FieldProps & SelectHTMLAttributes<HTMLSelectElement>
>(({ label, error, className = "", children, ...props }, ref) => (
  <label className="flex flex-col gap-1 text-sm">
    <span className="text-slate-400">{label}</span>
    <select
      ref={ref}
      className={`rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-emerald-500 ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <span className="text-xs text-red-400">{error}</span>}
  </label>
));
Select.displayName = "Select";
