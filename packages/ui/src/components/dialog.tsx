import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '../utils';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within a Dialog');
  }
  return context;
}

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback(
    (newOpen: boolean) => {
      setUncontrolledOpen(newOpen);
      onOpenChange?.(newOpen);
    },
    [onOpenChange]
  );

  return <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>;
}

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function DialogTrigger({ className, children, ...props }: DialogTriggerProps) {
  const { setOpen } = useDialogContext();

  return (
    <button className={cn('', className)} onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
}

export interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

export function DialogContent({ className, children }: DialogContentProps) {
  const { open, setOpen } = useDialogContext();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div
        className={cn(
          'relative z-50 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl',
          className
        )}
      >
        <button
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          onClick={() => setOpen(false)}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}

export interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function DialogTitle({ className, children, ...props }: DialogTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold text-slate-900', className)} {...props}>
      {children}
    </h2>
  );
}

export interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export function DialogDescription({ className, children, ...props }: DialogDescriptionProps) {
  return (
    <p className={cn('mt-2 text-sm text-slate-500', className)} {...props}>
      {children}
    </p>
  );
}

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogFooter({ className, children, ...props }: DialogFooterProps) {
  return (
    <div className={cn('mt-6 flex justify-end gap-3', className)} {...props}>
      {children}
    </div>
  );
}