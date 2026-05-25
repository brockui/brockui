"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Search } from "lucide-react";
import {
  components,
  type ComponentItem,
} from "@/lib/components-catalog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return components;
    return components.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIdx(0);
    }
  }, [open]);

  function navigate(item: ComponentItem) {
    if (item.status === "SOON") return;
    router.push(item.href);
    onOpenChange(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selectedIdx];
      if (item) navigate(item);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed top-[20vh] left-1/2 z-50 flex w-full max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-md border border-white/10 bg-background shadow-2xl"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Search components</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to search Brock UI components and pages
          </Dialog.Description>

          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search components..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map((item, i) => {
                const isSoon = item.status === "SOON";
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item)}
                    onMouseEnter={() => setSelectedIdx(i)}
                    disabled={isSoon}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      i === selectedIdx && !isSoon ? "bg-white/5" : ""
                    } ${isSoon ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-20 shrink-0 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
                        {item.category}
                      </span>
                      <span className="truncate text-foreground">
                        {item.name}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-[10px] tracking-wider uppercase ${
                        item.status === "NEW"
                          ? "text-brock-accent"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {item.status}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 font-mono text-[10px] text-muted-foreground">
            <span>↑↓ navigate · ⏎ open · ESC close</span>
            <span>
              {filtered.length} of {components.length}
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
