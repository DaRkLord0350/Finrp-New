// 
"use client";

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

const AlertDialog =
  AlertDialogPrimitive.Root;

const AlertDialogTrigger =
  AlertDialogPrimitive.Trigger;

const AlertDialogPortal =
  AlertDialogPrimitive.Portal;

const AlertDialogOverlay =
  AlertDialogPrimitive.Overlay;

const AlertDialogContent =
  AlertDialogPrimitive.Content;

const AlertDialogAction =
  AlertDialogPrimitive.Action;

const AlertDialogCancel =
  AlertDialogPrimitive.Cancel;

const AlertDialogTitle =
  AlertDialogPrimitive.Title;

const AlertDialogDescription =
  AlertDialogPrimitive.Description;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="flex flex-col space-y-2 text-center sm:text-left"
    {...props}
  />
);

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
    {...props}
  />
);

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogFooter,
};