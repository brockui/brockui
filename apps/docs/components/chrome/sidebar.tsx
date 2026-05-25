"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { components, type ComponentItem } from "@/lib/components-catalog";

type IconProps = { className?: string };

function FolderIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeMiterlimit="10"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.5 21L21.5 12L2.5 12L3.5 21L20.5 21Z" />
      <path d="M20 8V6H12.5L9.5 3H4V8" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeMiterlimit="10"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
    >
      <path d="M8 20.5L16.5 12L8 3.5" />
    </svg>
  );
}

function WorkflowIcon({ className }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 12V7.5" />
      <path d="M6 16.5V12H18V16.5" />
      <path d="M14.5 2.5L14.5 7.5L9.5 7.5L9.5 2.5L14.5 2.5Z" />
      <path d="M8.5 16.5L8.5 21.5L3.5 21.5L3.5 16.5L8.5 16.5Z" />
      <path d="M20.5 16.5L20.5 21.5L15.5 21.5L15.5 16.5L20.5 16.5Z" />
    </svg>
  );
}

const SECTION_LABEL =
  "hidden px-5 pt-5 pb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60 group-hover/sidebar:block";
const ROW = "flex h-10 w-full items-center gap-2 px-4 text-sm transition-colors";
const ROW_LABEL = "hidden flex-1 truncate text-left group-hover/sidebar:block";
const ROW_CHEVRON =
  "hidden h-3.5 w-3.5 shrink-0 transition-transform group-hover/sidebar:block";
const SUB_BASE =
  "flex h-9 w-full items-center border-l pr-5 pl-5 text-sm transition-colors";
const IDLE = "text-[#A6A6A6] hover:bg-[#1A1A1A] hover:text-white";
const ACTIVE = "bg-[#222222] text-white";

function SubItem({ item, active }: { item: ComponentItem; active: boolean }) {
  if (item.status === "SOON") {
    return (
      <span
        className={`${SUB_BASE} cursor-not-allowed border-white/10 text-[#A6A6A6]/40`}
      >
        {item.name}
      </span>
    );
  }
  if (active) {
    return (
      <Link
        href={item.href}
        className={`${SUB_BASE} border-brock-accent ${ACTIVE}`}
      >
        {item.name}
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      className={`${SUB_BASE} border-white/10 hover:border-brock-accent ${IDLE}`}
    >
      {item.name}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [librariesOpen, setLibrariesOpen] = useState<boolean>(true);
  const [workflowsOpen, setWorkflowsOpen] = useState<boolean>(false);

  const charts = components.filter((c) => c.category === "Charts");
  const workflows = components.filter((c) => c.category === "Workflows");

  return (
    <aside className="group/sidebar sticky top-15 h-[calc(100vh-3.75rem)] w-12 shrink-0">
      <div className="absolute inset-y-0 left-0 z-40 flex h-full w-12 flex-col overflow-hidden border-r border-white/10 bg-background transition-[width] duration-100 ease-linear group-hover/sidebar:w-65">
        <nav className="flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-4">
          <div className={SECTION_LABEL}>Charts</div>
          <div>
            <button
              onClick={() => setLibrariesOpen(!librariesOpen)}
              className={`${ROW} cursor-pointer ${IDLE}`}
              aria-expanded={librariesOpen}
            >
              <FolderIcon className="h-4 w-4 shrink-0" />
              <span className={ROW_LABEL}>Libraries</span>
              <ChevronIcon
                className={`${ROW_CHEVRON} ${librariesOpen ? "rotate-90" : ""}`}
              />
            </button>

            {librariesOpen && (
              <ul className="ml-7 hidden group-hover/sidebar:block">
                {charts.map((item) => (
                  <li key={item.id}>
                    <SubItem item={item} active={pathname === item.href} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={SECTION_LABEL}>Agents</div>
          <div>
            <button
              onClick={() => setWorkflowsOpen(!workflowsOpen)}
              className={`${ROW} cursor-pointer ${IDLE}`}
              aria-expanded={workflowsOpen}
            >
              <WorkflowIcon className="h-4 w-4 shrink-0" />
              <span className={ROW_LABEL}>Workflows</span>
              <ChevronIcon
                className={`${ROW_CHEVRON} ${workflowsOpen ? "rotate-90" : ""}`}
              />
            </button>

            {workflowsOpen && (
              <ul className="ml-7 hidden group-hover/sidebar:block">
                {workflows.map((item) => (
                  <li key={item.id}>
                    <SubItem item={item} active={pathname === item.href} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
}
