'use client';

import { BellIcon, UserCircleIcon } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <BellIcon className="h-4 w-4" />
        </button>
        <button className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <UserCircleIcon className="h-5 w-5" />
          <span className="hidden sm:inline">Account</span>
        </button>
      </div>
    </header>
  );
}
