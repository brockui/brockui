"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { components, type ComponentItem } from "@/lib/components-catalog";
import { MotionIcon } from "./motion-icon";
import { CaretIcon } from "./icons";
import filesMotion from "./icons/files-motion.json";
import workflowMotion from "./icons/workflow-motion.json";

const SECTION_LABEL =
  "hidden px-5 pt-5 pb-2 font-sans text-[11px] font-medium text-muted-foreground/60 group-hover/sidebar:block";
const ROW =
  "group/nav flex h-10 w-full items-center gap-2 px-4 text-sm transition-colors";
// Label + chevron sit together at the left (chevron tight to the title, the
// Resend / Linear / Vercel pattern) — the group is flex-1 so the empty space
// falls to the right of the chevron, not between label and chevron.
const ROW_GROUP =
  "hidden min-w-0 flex-1 items-center gap-1.5 group-hover/sidebar:flex";
const ROW_LABEL = "truncate text-left";
const ROW_CHEVRON = "h-[18px] w-[18px] shrink-0";
// Sub-items: rounded, inset rows (Vercel / Linear / Resend nav). A single
// faint guide line shows the nesting; hover is a soft rounded fill and the
// active row is an accent-tinted pill — no per-item sharp rail.
const SUB_BASE =
  "flex h-8 w-full items-center rounded-md px-3 text-[13px] transition-colors";
const IDLE = "text-muted-foreground hover:bg-accent hover:text-foreground";
const ACTIVE = "bg-brock-accent/10 text-brock-accent font-medium";

function SubItem({ item, active }: { item: ComponentItem; active: boolean }) {
  if (item.status === "SOON") {
    return (
      <span
        className={`${SUB_BASE} cursor-not-allowed text-muted-foreground/40`}
      >
        {item.name}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`${SUB_BASE} ${active ? ACTIVE : IDLE}`}
    >
      {item.name}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [librariesOpen, setLibrariesOpen] = useState<boolean>(true);
  const [workflowsOpen, setWorkflowsOpen] = useState<boolean>(false);
  const [hoverLibraries, setHoverLibraries] = useState(false);
  const [hoverWorkflows, setHoverWorkflows] = useState(false);

  const charts = components.filter((c) => c.category === "Charts");
  const workflows = components.filter((c) => c.category === "Workflows");

  return (
    <aside className="group/sidebar sticky top-12 h-[calc(100vh-3rem)] w-12 shrink-0">
      <div className="absolute inset-y-0 left-0 z-40 flex h-full w-12 flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-100 ease-linear group-hover/sidebar:w-65">
        <nav className="flex-1 overflow-x-hidden overflow-y-auto pt-2 pb-4">
          <div className={SECTION_LABEL}>Charts</div>
          <div>
            <button
              onClick={() => setLibrariesOpen(!librariesOpen)}
              onMouseEnter={() => setHoverLibraries(true)}
              onMouseLeave={() => setHoverLibraries(false)}
              className={`${ROW} cursor-pointer ${IDLE}`}
              aria-expanded={librariesOpen}
            >
              <MotionIcon
                data={filesMotion}
                playing={hoverLibraries}
                className="h-[18px] w-[18px] shrink-0 group-hover/nav:opacity-100"
              />
              <span className={ROW_GROUP}>
                <span className={ROW_LABEL}>Libraries</span>
                <CaretIcon
                  className={`${ROW_CHEVRON} transition-transform ${
                    librariesOpen ? "" : "-rotate-90"
                  }`}
                />
              </span>
            </button>

            {librariesOpen && (
              <ul className="ml-6 mr-2 hidden space-y-0.5 border-l border-border py-1 pl-2 group-hover/sidebar:block">
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
              onMouseEnter={() => setHoverWorkflows(true)}
              onMouseLeave={() => setHoverWorkflows(false)}
              className={`${ROW} cursor-pointer ${IDLE}`}
              aria-expanded={workflowsOpen}
            >
              <MotionIcon
                data={workflowMotion}
                playing={hoverWorkflows}
                className="h-[18px] w-[18px] shrink-0 group-hover/nav:opacity-100"
              />
              <span className={ROW_GROUP}>
                <span className={ROW_LABEL}>Workflows</span>
                <CaretIcon
                  className={`${ROW_CHEVRON} transition-transform ${
                    workflowsOpen ? "" : "-rotate-90"
                  }`}
                />
              </span>
            </button>

            {workflowsOpen && (
              <ul className="ml-6 mr-2 hidden space-y-0.5 border-l border-border py-1 pl-2 group-hover/sidebar:block">
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
