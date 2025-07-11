import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isLocalhost(): boolean {
  // Server-side check
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "development"
  }
  
  const hostname = window.location.hostname;
  
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname.includes(".app.github.dev") || // GitHub Codespaces
    hostname.includes(".gitpod.io") || // Gitpod
    hostname.includes(".repl.co") || // Replit
    hostname.includes("codesandbox.io") || // CodeSandbox
    process.env.NODE_ENV === "development" // Development environment
  );
}


