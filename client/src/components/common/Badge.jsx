/**
 * Badge — Reusable semantic badge/pill component.
 *
 * Variants: critical | warning | success | info | escalated | under-review
 *           resolved | neutral | open | high | medium | low | blue | amber
 * Sizes: sm | md (default)
 *
 * Usage:
 *   <Badge variant="critical">OPEN</Badge>
 *   <Badge variant="success" size="sm">RESOLVED</Badge>
 *   <Badge variant="escalated">ESCALATED</Badge>
 *
 * NO inline hex colors — all styling comes from app.css .badge classes.
 */
export default function Badge({ variant = 'neutral', size = 'md', children, className = '' }) {
  const sizeClass = size === 'sm' ? 'badge--sm' : 'badge--md';
  return (
    <span className={`badge ${variant} ${sizeClass} ${className}`.trim()}>
      {children}
    </span>
  );
}
