import { CopyButton } from "@/components/ui/copy-button";

const quickStart = "npx shadcn@latest add brockui.com/r/bar-chart";

const themeVariables = `:root {
  --brock-accent: oklch(0.646 0.222 41.116); /* #F54900 — Orange */
}

.dark {
  --brock-accent: oklch(0.646 0.222 41.116);
}`;

const themeInline = `@theme inline {
  --color-brock-accent: var(--brock-accent);
}`;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative border border-border bg-card">
      <pre className="overflow-x-auto p-4 pr-12 font-mono text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} />
      </div>
    </div>
  );
}

export default function InstallationPage() {
  return (
    <div className="mx-auto max-w-3xl p-10">
      <div className="mb-12">
        <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Get Started · Installation
        </div>
        <h1 className="text-3xl font-normal text-foreground tracking-tight mb-3">
          Installation
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Brock UI uses the shadcn registry format. Components are copied into
          your project — you own the code. No runtime dependency on a Brock UI
          package.
        </p>
      </div>

      <Section title="Quick start">
        <p className="text-sm text-muted-foreground mb-4">
          Add any component to your project with one command:
        </p>
        <CodeBlock code={quickStart} />
      </Section>

      <Section title="Prerequisites">
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            ·{" "}
            <span className="text-foreground font-mono text-xs">Next.js</span>{" "}
            16+ (or React 19+ for other frameworks)
          </li>
          <li>
            ·{" "}
            <span className="text-foreground font-mono text-xs">
              Tailwind CSS
            </span>{" "}
            v4
          </li>
          <li>
            ·{" "}
            <span className="text-foreground font-mono text-xs">shadcn</span>{" "}
            CLI:{" "}
            <code className="font-mono text-xs text-foreground">
              npm i -D shadcn
            </code>
          </li>
          <li>
            · A working{" "}
            <code className="font-mono text-xs text-foreground">
              components.json
            </code>{" "}
            (run{" "}
            <code className="font-mono text-xs text-foreground">
              npx shadcn init
            </code>{" "}
            if missing)
          </li>
        </ul>
      </Section>

      <Section title="Theme setup">
        <p className="text-sm text-muted-foreground mb-4">
          Add the Brock UI accent color to your{" "}
          <code className="font-mono text-xs text-foreground">
            globals.css
          </code>
          . Without it, components render in default grey.
        </p>
        <CodeBlock code={themeVariables} />
      </Section>

      <Section title="Tailwind v4 token">
        <p className="text-sm text-muted-foreground mb-4">
          Expose the variable as a Tailwind token so you can use{" "}
          <code className="font-mono text-xs text-foreground">
            bg-brock-accent
          </code>
          ,{" "}
          <code className="font-mono text-xs text-foreground">
            text-brock-accent
          </code>{" "}
          and{" "}
          <code className="font-mono text-xs text-foreground">
            border-brock-accent
          </code>{" "}
          throughout your project. Add inside your{" "}
          <code className="font-mono text-xs text-foreground">
            @theme inline
          </code>{" "}
          block:
        </p>
        <CodeBlock code={themeInline} />
      </Section>

      <Section title="Customize the accent">
        <p className="text-sm text-muted-foreground max-w-2xl">
          One variable controls all accents across every Brock UI component.
          Change{" "}
          <code className="font-mono text-xs text-foreground">
            --brock-accent
          </code>{" "}
          once — every chart, every highlight, every active state updates. We
          recommend a single, distinct color in OKLCH for predictable behavior
          across themes.
        </p>
      </Section>

      <Section title="What you get">
        <ul className="text-sm text-muted-foreground space-y-2 max-w-2xl">
          <li>
            ·{" "}
            <span className="text-foreground">Source files in your repo</span>{" "}
            — fully editable, no black-box package
          </li>
          <li>
            ·{" "}
            <span className="text-foreground">
              Typed props, zero runtime dependencies
            </span>{" "}
            beyond React and Tailwind
          </li>
          <li>
            ·{" "}
            <span className="text-foreground">
              Dark mode and light mode parity
            </span>{" "}
            out of the box
          </li>
          <li>
            ·{" "}
            <span className="text-foreground">
              MIT license, no attribution required
            </span>
          </li>
        </ul>
      </Section>
    </div>
  );
}
