import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClass = {
  sm: "h-3 w-3",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/**
 * 1–5 star rating, interactive or read-only.
 *
 * This is a portal for people with disabilities, so the interactive mode is
 * built as a real radiogroup rather than a grid of clickable divs: arrow keys
 * move the rating, Home/End jump to the ends, and only the selected star is a
 * tab stop (roving tabindex). Screen readers announce "3 stars, radio, 3 of 5".
 */
const StarRating = ({
  value,
  onChange,
  readOnly = false,
  max = 5,
  size = "md",
  className,
  label = "Rating"
}) => {
  const [hovered, setHovered] = useState(null);
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  // ---- Read-only: a single labelled image, not 5 focusable controls -------
  if (readOnly) {
    return (
      <div
        className={cn("flex items-center gap-0.5", className)}
        role="img"
        aria-label={`Rated ${value} out of ${max}`}>
        {stars.map((star) => (
          <Star
            key={star}
            aria-hidden="true"
            className={cn(
              sizeClass[size],
              star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted"
            )} />
        ))}
      </div>
    );
  }

  const set = (next) => onChange?.(Math.min(Math.max(next, 1), max));

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        set((value || 0) + 1);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        set((value || 1) - 1);
        break;
      case "Home":
        e.preventDefault();
        set(1);
        break;
      case "End":
        e.preventDefault();
        set(max);
        break;
    }
  };

  const shown = hovered ?? value;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex items-center gap-1", className)}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHovered(null)}>
      {stars.map((star) => {
        const selected = star === value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            // Roving tabindex: one tab stop for the whole group.
            tabIndex={selected || (!value && star === 1) ? 0 : -1}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={() => set(star)}
            onMouseEnter={() => setHovered(star)}>
            <Star
              aria-hidden="true"
              className={cn(sizeClass[size], star <= shown
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground")} />
          </button>
        );
      })}
      <span className="ml-2 text-sm text-muted-foreground" aria-hidden="true">
        {value ? `${value} of ${max}` : "Select a rating"}
      </span>
    </div>
  );
};

export default StarRating;
