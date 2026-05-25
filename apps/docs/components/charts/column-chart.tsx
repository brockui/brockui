export type ColumnChartProps = {
  data: number[];
  labels?: string[];
  height?: number;
  gap?: number;
  className?: string;
};

export function ColumnChart({
  data,
  labels,
  height = 200,
  gap = 4,
  className,
}: ColumnChartProps) {
  const max = Math.max(...data, 1);

  return (
    <div className={className}>
      <div
        className="flex items-end w-full"
        style={{ height, gap }}
        aria-hidden
      >
        {data.map((value, i) => {
          const barHeight = Math.max((value / max) * 100, 1);
          return (
            <div
              key={i}
              className="flex-1 bg-brock-accent"
              style={{ height: `${barHeight}%` }}
            />
          );
        })}
      </div>

      {labels && labels.length > 0 && (
        <div className="flex justify-between mt-3 font-mono text-[10px] text-muted-foreground">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      )}
    </div>
  );
}
