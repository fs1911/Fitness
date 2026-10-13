"use client";
import { useSearchParams } from "next/navigation";

/** Muss innerhalb einer <Suspense>-Grenze verwendet werden (statischer Export). */
export function useQueryParam(name: string): string | null {
  return useSearchParams().get(name);
}
