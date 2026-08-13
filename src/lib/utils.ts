import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatTimestamp(iso: string, locale: string = "en-US"): string {
  const d = new Date(iso);
  const loc = locale === "zh" ? "zh-CN" : locale;
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const time = d.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return `${month}-${day} ${time}`;
}

export function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatOptionalLatency(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  return formatLatency(ms);
}
