import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .slice(0, 1000);
}

export function sanitizeEmail(email: string): string {
  return email
    .replace(/[^a-zA-Z0-9@._+-]/g, '')
    .toLowerCase()
    .trim()
    .slice(0, 254);
}
