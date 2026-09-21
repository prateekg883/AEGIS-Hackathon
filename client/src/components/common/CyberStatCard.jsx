import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

/* ── Animated counter hook ───────────────────────────── */
function useCountUp(target, duration = 1.4) {
  const motionVal = useMotionValue(0);
  const rounded   = useTransform(motionVal, (v) => {
    const n = Number(v);
    if (Number.isInteger(target)) return Math.round(n).toLocaleString();
    return n.toFixed(1);
  });

  useEffect(() => {
    const controls = animate(motionVal, Number(target) || 0, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [target, duration, motionVal]);

  return rounded;
}

/* ── Variant colour maps ─────────────────────────────── */
const VARIANT = {
  default: {
    iconBg:     'rgba(0, 212, 255, 0.08)',
    iconBorder: 'rgba(0, 212, 255, 0.2)',
    iconColor:  'var(--neon-cyan)',
    glow:       'rgba(0, 212, 255, 0.12)',
    accent:     'var(--neon-cyan)',
    gradient:   'linear-gradient(135deg, rgba(0,212,255,0.06) 0%, transparent 60%)',
  },
  red: {
    iconBg:     'rgba(255, 71, 87, 0.1)',
    iconBorder: 'rgba(255, 71, 87, 0.3)',
    iconColor:  'var(--neon-red)',
    glow:       'rgba(255, 71, 87, 0.1)',
    accent:     'var(--neon-red)',
    gradient:   'linear-gradient(135deg, rgba(255,71,87,0.06) 0%, transparent 60%)',
  },
  amber: {
    iconBg:     'rgba(245, 158, 11, 0.1)',
    iconBorder: 'rgba(245, 158, 11, 0.3)',
    iconColor:  'var(--neon-amber)',
    glow:       'rgba(245, 158, 11, 0.1)',
    accent:     'var(--neon-amber)',
    gradient:   'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, transparent 60%)',
  },
  blue: {
    iconBg:     'rgba(59, 130, 246, 0.1)',
    iconBorder: 'rgba(59, 130, 246, 0.3)',
    iconColor:  'var(--neon-blue-bright)',
    glow:       'rgba(59, 130, 246, 0.1)',
    accent:     'var(--neon-blue-bright)',
    gradient:   'linear-gradient(135deg, rgba(59,130,246,0.06) 0%, transparent 60%)',
  },
  green: {
    iconBg:     'rgba(16, 185, 129, 0.1)',
    iconBorder: 'rgba(16, 185, 129, 0.3)',
    iconColor:  'var(--neon-green)',
    glow:       'rgba(16, 185, 129, 0.1)',
    accent:     'var(--neon-green)',
    gradient:   'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, transparent 60%)',
  },
};

/* ── Component ───────────────────────────────────────── */
export default function CyberStatCard({
  label,
  value,
  meta,
  icon: Icon,
  type = 'default',
  animate: shouldAnimate = true,
  index = 0,
}) {
  const v = VARIANT[type] || VARIANT.default;
  const displayVal = useCountUp(shouldAnimate ? value : 0, 1.2 + index * 0.1);

  return (
    <motion.div
      className={`card stat ${type}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.07,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      style={{ position: 'relative', overflow: 'hidden', cursor: 'default' }}
    >
      {/* Gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: v.gradient, pointerEvents: 'none' }} />

      {/* Corner accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${v.accent}, transparent)`,
        opacity: 0.5,
      }} />

      {/* Icon */}
      <motion.div
        className="stat-icon"
        style={{
          background: v.iconBg,
          border: `1px solid ${v.iconBorder}`,
          boxShadow: `0 0 16px ${v.glow}`,
          color: v.iconColor,
        }}
        whileHover={{ scale: 1.1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {Icon && <Icon size={18} />}
      </motion.div>

      {/* Text */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
        <span style={{
          fontFamily: "var(--font-display, 'Orbitron')",
          fontSize: '10px', fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {label}
        </span>

        <motion.strong style={{
          fontFamily: "var(--font-display, 'Orbitron')",
          fontSize: '26px', letterSpacing: '-0.01em',
          color: 'var(--color-text-heading)', fontWeight: 800,
          display: 'block', lineHeight: 1.1,
        }}>
          {shouldAnimate ? displayVal : String(value)}
        </motion.strong>

        {meta && (
          <small style={{ fontSize: '10.5px', color: 'var(--color-text-muted)' }}>
            {meta}
          </small>
        )}
      </div>
    </motion.div>
  );
}
