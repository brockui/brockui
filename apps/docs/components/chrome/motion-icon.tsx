"use client";

import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { useEffect, useRef } from "react";

/**
 * Motion icon — a Lottie animation that plays while `playing` is true (e.g.
 * its sidebar row is hovered) and resets to the first frame otherwise. The
 * source icons are monochrome black; since Lottie bakes its colours and can't
 * inherit `currentColor`, the theme is faked with Tailwind utilities — dimmed
 * in light, inverted-to-light + dimmed in dark. Callers pass size + any
 * group-hover brightening via `className`.
 */
export function MotionIcon({
  data,
  playing,
  className,
}: {
  data: object;
  playing: boolean;
  className?: string;
}) {
  const ref = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    const lottie = ref.current;
    if (!lottie) return;
    if (playing) lottie.play();
    else lottie.stop();
  }, [playing]);

  return (
    <span
      className={`inline-block opacity-65 transition-opacity duration-150 dark:opacity-80 dark:invert ${className ?? ""}`}
      aria-hidden
    >
      <Lottie
        lottieRef={ref}
        animationData={data}
        loop
        autoplay={false}
        className="h-full w-full"
      />
    </span>
  );
}
