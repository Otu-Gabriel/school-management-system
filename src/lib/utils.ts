import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fullName(parts: {
  firstName?: string | null;
  lastName?: string | null;
  otherNames?: string | null;
  fullName?: string | null;
}) {
  if (parts.fullName) return parts.fullName;
  return [parts.firstName, parts.otherNames, parts.lastName]
    .filter(Boolean)
    .join(" ");
}
