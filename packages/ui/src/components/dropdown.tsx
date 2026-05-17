import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { cn } from '../utils';

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const DropdownContext = createContext<DropdownContextValue | undefined>(undefined);

function useDropdownContext() {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('Dropdown components must be used within a Dropdown');
  }
  return context;
}

export interface DropdownProps {
  children: React.ReactNode;
}

export function Dropdown({ children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function DropdownTrigger({ className, children, ...props }: DropdownTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownContext();

  return (
    <button
      ref={triggerRef}
      className={cn('inline-flex items-center justify-center', className)}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownContentProps {
  className?: string;
  children: React.ReactNode;
}

export function DropdownContent({ className, children }: DropdownContentProps) {
  const { open } = useDropdownContext();

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 w-56 rounded-lg bg-white py-1 shadow-lg border border-slate-200',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function DropdownItem({
  className,
  destructive,
  children,
  ...props
}: DropdownItemProps) {
  return (
    <button
      className={cn(
        'w-full px-4 py-2 text-left text-sm',
        destructive ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DropdownSeparator({ className, ...props }: DropdownSeparatorProps) {
  return <div className={cn('my-1 h-px bg-slate-200', className)} {...props} />;
}