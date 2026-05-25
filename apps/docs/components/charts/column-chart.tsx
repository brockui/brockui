export type ColumnChartProps = {
  data: number[];
  labels?: string[];
  height?: number;
  gap?: number;
  trend?: number;
  source?: string;
  yAxisFormat?: (value: number) => string;
  formatValue?: (value: number) => string;
  className?: string;
};

const defaultFormat = (v: number) => v.toLocaleString();

export function ColumnChart({
  data,
  labels,
  height = 200,
  gap = 4,
  trend,
  source,
  yAxisFormat = defaultFormat,
  formatValue = defaultFormat,
  className,
}: ColumnChartProps) {
  if (data.length === 0) {
    return (
      <div className={className}>
        <div
          className="flex items-center justify-center border-b border-l border-white/10 font-pixel text-xs tracking-wider text-muted-foreground/40"
          style={{ height }}
        >
          ▒▒▒ no data for this period
        </div>
        {source && <ChartSource source={source} />}
      </div>
    );
  }

  const max = Math.max(...data, 1);
  const yTicks = [max, Math.round(max / 2), 0];

  return (
    <div className={className}>
      {trend !== undefined && (
        <div className="mb-3 flex justify-end">
          <span
            className={`font-mono text-xs tabular-nums ${
              trend >= 0 ? "text-brock-accent" : "text-muted-foreground"
            }`}
          >
            {trend >= 0 ? "↗" : "↘"} {trend >= 0 ? "+" : ""}
            {(trend * 100).toFixed(1)}%
          </span>
        </div>
      )}

      <div className="flex" style={{ height }}>
        <div
          className="flex w-10 shrink-0 flex-col justify-between border-r border-white/10 pr-2 font-mono text-[10px] tabular-nums text-muted-foreground/60"
          aria-hidden
        >
          {yTicks.map((tick) => (
            <div key={tick} className="text-right leading-none">
              {yAxisFormat(tick)}
            </div>
          ))}
        </div>

        <div
          className="brock-bars flex flex-1 items-end border-b border-white/10"
          style={{ gap }}
        >
          {data.map((value, i) => {
            const barHeight = Math.max((value / max) * 100, 1);
            const label = labels?.[i];
            return (
              <div
                key={i}
                className="group/bar relative flex flex-1 items-end self-stretch"
              >
                <div
                  className="brock-bar w-full bg-brock-accent transition-[filter] duration-150 group-hover/bar:brightness-110"
                  style={
                    {
                      height: `${barHeight}%`,
                      animationDelay: `${i * 30}ms`,
                    } as React.CSSProperties
                  }
                />

                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 flex-col items-center gap-1 group-hover/bar:flex"
                  role="tooltip"
                >
                  {label && (
                    <span className="bg-foreground px-1.5 py-0.5 font-pixel text-[10px] tracking-wider whitespace-nowrap text-background uppercase">
                      {label}
                    </span>
                  )}
                  <span className="rounded-[2px] border border-white/10 bg-background px-2 py-1 font-mono text-xs tabular-nums whitespace-nowrap text-foreground">
                    {formatValue(value)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {labels && labels.length > 0 && (
        <div
          className="mt-2 flex font-pixel text-[10px] tracking-wider text-muted-foreground/70 uppercase"
          style={{ gap, paddingLeft: 40 }}
          aria-hidden
        >
          {labels.map((label, i) => (
            <span key={i} className="flex-1 truncate text-center">
              {label}
            </span>
          ))}
        </div>
      )}

      {source && <ChartSource source={source} />}

      <style>{`
        .brock-bars .brock-bar {
          animation: brock-bar-rise 400ms cubic-bezier(0.22, 0.61, 0.36, 1) backwards;
        }
        @keyframes brock-bar-rise {
          from {
            transform: scaleY(0);
            transform-origin: bottom;
          }
          to {
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .brock-bars .brock-bar {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function ChartSource({ source }: { source: string }) {
  return (
    <div className="mt-4 font-mono text-[10px] tracking-wider text-muted-foreground/60 uppercase">
      Source: {source}
    </div>
  );
}
