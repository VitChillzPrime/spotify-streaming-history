import { cn } from "@/lib/ui";

// Fixed heights and timings (no randomness, so server and client render the same markup).
const BARS = Array.from({ length: 56 }, (_, i) => {
  const wave = Math.sin(i * 0.42) * 0.5 + Math.sin(i * 0.17 + 1.3) * 0.35 + 0.15;
  return {
    height: Math.round(28 + Math.abs(wave) * 72),
    delay: ((i * 137) % 1400) / 1000,
    duration: 1.1 + ((i * 53) % 9) / 10,
  };
});

/** A decorative, gently animated equaliser. Hidden from assistive tech; static with reduced motion. */
export function Equalizer({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-24 items-end justify-center gap-[5px]", className)}>
      {BARS.map((bar, i) => (
        <span
          key={i}
          className="eq-bar block w-[3px] shrink-0 rounded-full bg-accent"
          style={{
            height: `${bar.height}%`,
            animationDelay: `-${bar.delay}s`,
            animationDuration: `${bar.duration}s`,
            opacity: 0.25 + (bar.height / 100) * 0.55,
          }}
        />
      ))}
    </div>
  );
}
