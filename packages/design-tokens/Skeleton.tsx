'use client';

/**
 * Skeleton loader — CONVENTIONS.md design anti-pattern rule 21,
 * SAAS_UX_PATTERNS.md item 2, UNSLOP_DESIGN_RULES.md item 19.
 *
 * Shows a pulsing placeholder that matches the eventual layout while
 * data loads. Never a bare spinner or blank screen.
 *
 * Usage:
 *   <Skeleton /> — default line-shaped skeleton
 *   <Skeleton width={40} height={40} /> — custom size (e.g. avatar)
 *   <Skeleton count={3} /> — stacked lines (e.g. list items)
 */

export interface SkeletonProps {
  /** Width in px (default: 100%) */
  width?: number | string;
  /** Height in px (default: 1rem / 16px) */
  height?: number | string;
  /** Number of stacked skeleton lines (default: 1) */
  count?: number;
  /** Gap between stacked lines in px (default: 8px) */
  gap?: number;
  /** Additional CSS class */
  className?: string;
}

const pulseKeyframes = `
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

export function Skeleton({
  width = '100%',
  height = '1rem',
  count = 1,
  gap = 8,
  className = '',
}: SkeletonProps) {
  const style: React.CSSProperties =
    typeof width === 'number' || typeof height === 'number'
      ? { width, height }
      : { width, height };

  if (count === 1) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={`skeleton ${className}`}
        style={style}
      />
    );
  }

  return (
    <div role="status" aria-label="Loading" className={`skeleton-stack ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            ...style,
            marginBottom: i < count - 1 ? gap : 0,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pre-built skeleton layouts for common patterns.
 */

export function CardSkeleton() {
  return (
    <div className="skeleton-card" role="status" aria-label="Loading card">
      <Skeleton width={48} height={48} />
      <div style={{ marginTop: 12 }}>
        <Skeleton count={2} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table" role="status" aria-label="Loading table">
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="skeleton-table-row">
          {Array.from({ length: columns }).map((_, ci) => (
            <Skeleton key={ci} height={20} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Inject the pulse animation once. Call this in a layout component or
 * include the SkeletonStyles component in your root layout.
 */
export function SkeletonStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: pulseKeyframes }} />
  );
}
