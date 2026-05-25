type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  gap?: number;
};

export function Sparkline({
  data,
  width = 280,
  height = 80,
  gap = 2,
}: SparklineProps) {
  const max = Math.max(...data, 1);
  const barWidth = (width - gap * (data.length - 1)) / data.length;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden
    >
      {data.map((value, i) => {
        const barHeight = Math.max((value / max) * height, 1);
        const x = i * (barWidth + gap);
        const y = height - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            fill="var(--brock-accent)"
          />
        );
      })}
    </svg>
  );
}
