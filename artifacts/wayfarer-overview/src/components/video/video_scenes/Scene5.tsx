import { motion } from 'framer-motion';

import { MapMark, CarryDot, FILM_EASE } from '../FilmPrimitives';

export function Scene5() {
  return (
    <motion.section
      className="film-scene s5"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)', scale: 1.04 }}
      animate={{ opacity: 1, clipPath: 'circle(100% at 50% 50%)', scale: 1 }}
      exit={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)', scale: 1.04 }}
      transition={{ duration: 0.72, ease: FILM_EASE }}
    >
      <div className="s5-grain" />
      <motion.div
        className="s5-orbit"
        initial={{ scale: 0.72, opacity: 0, rotate: -18 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.85, delay: 0.08, ease: FILM_EASE }}
        aria-hidden="true"
      />
      <motion.div
        className="s5-lockup"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: FILM_EASE }}
      >
        <motion.div
          initial={{ scale: 0.82, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.42, delay: 0.1, ease: FILM_EASE }}
        >
          <MapMark />
        </motion.div>
        <motion.h2
          className="s5-wordmark"
          initial={{ opacity: 0, letterSpacing: '-0.025em' }}
          animate={{ opacity: 1, letterSpacing: '-0.07em' }}
          transition={{ duration: 0.5, delay: 0.45, ease: FILM_EASE }}
        >
          wayfarer
        </motion.h2>
        <motion.p
          className="s5-tagline"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 1.35, ease: FILM_EASE }}
        >
          travel, considered
        </motion.p>
        <motion.p
          className="s5-promise"
          initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0%)' }}
          transition={{ duration: 0.58, delay: 1.92, ease: FILM_EASE }}
        >
          A city-specific plan. A clearer view of spend.
        </motion.p>
      </motion.div>
      <motion.span
        className="s5-loop-pin"
        initial={{ right: '15%', top: '50%', scale: 0.8 }}
        animate={{ right: '8%', top: '51%', scale: 1 }}
        transition={{ duration: 1.1, delay: 4.2, ease: FILM_EASE }}
        aria-hidden="true"
      />
      <CarryDot />
    </motion.section>
  );
}