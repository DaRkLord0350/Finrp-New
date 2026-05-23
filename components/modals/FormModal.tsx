"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FormModalProps {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

export function FormModal({
  trigger,
  title,
  children,
}: FormModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>

      <DialogContent className="max-w-2xl rounded-2xl border bg-background p-6 shadow-xl">
        <DialogHeader>
          <DialogTitle>
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}