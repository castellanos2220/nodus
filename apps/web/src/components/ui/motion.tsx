'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

/**
 * Microinteracciones — deliberadamente pocas.
 *
 * Sólo aparición de contenido y desplazamientos cortos (≤6px, ≤240ms). Ninguna
 * animación bloquea la interacción ni retrasa la lectura. `MotionConfig` en
 * `providers.tsx` las desactiva si el sistema pide movimiento reducido.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  delay = 0,
  y = 6,
  children,
  ...props
}: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
};

/** Contenedor que hace aparecer a sus hijos `StaggerItem` en cascada. */
export function Stagger({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={staggerChild} {...props}>
      {children}
    </motion.div>
  );
}

export { motion, AnimatePresence } from 'framer-motion';
