"use client";

export function LoadingState() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}