"use client";

import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { useEffect, useRef } from "react";

/**
 * Motion icon — a Lottie animation that plays while `playing` is true (e.g.
 * its sidebar row is hovered) and resets to the first frame otherwise. The
 * source icons are monochrome black; theming is handled in CSS
 * (`.brock-motion-icon` — dimmed in light, inverted+dimmed in dark) since
 * Lottie bakes its colours and can't inherit `currentColor`.
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
    <span className={`brock-motion-icon ${className ?? ""}`} aria-hidden>
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
