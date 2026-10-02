import { motion } from 'framer-motion';

import { CarryDot, FILM_EASE } from '../FilmPrimitives';

export function Scene1() {
  return (
    <motion.section
      className="film-scene s1"
      initial={{ opacity: 0, scale: 1.025, clipPath: 'inset(0 0 0 100%)' }}
      animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0 0%)' }}
      exit={{ opacity: 0, scale: 1.06, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.55, ease: FILM_EASE }}
    >
      <div className="s1-grid" />
      <div className="film-meta">
        <span>Wayfarer / City discovery</span>
        <span>01 — Place</span>
      </div>
      <div className="s1-layout">
        <div className="s1-copy">
          <motion.p
            className="s1-hook"
            initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0% 0 0)' }}
            transition={{ duration: 0.42, delay: 0.08, ease: FILM_EASE }}
          >
            Not just a pin.
          </motion.p>
          <motion.h1
            className="s1-title"
            initial={{ opacity: 0, y: '0.14em' }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.62, delay: 0.5, ease: FILM_EASE }}
          >
            Singapore<em>.</em>
          </motion.h1>
          <motion.p
            className="s1-sub"
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 2.7, ease: FILM_EASE }}
          >
            Local places. One city.
          </motion.p>
        </div>

        <div className="s1-map" aria-hidden="true">
          <svg className="s1-route" viewBox="0 0 600 500" preserveAspectRatio="none">
            <motion.path
              d="M 105 380 C 153 314 177 279 241 286 C 308 293 310 190 370 191 C 431 192 437 118 512 107"
              pathLength={1}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.8, delay: 0.78, ease: FILM_EASE }}
            />
          </svg>
          <motion.div
            className="s1-pin"
            initial={{ scale: 0.72, opacity: 0.6 }}
            animate={{ scale: [0.72, 1.08, 1], opacity: 1 }}
            transition={{ duration: 0.72, delay: 0.32, ease: FILM_EASE }}
          >
            <div className="s1-pin-core" />
          </motion.div>
          <motion.div
            className="s1-label l1"
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 1.65, ease: FILM_EASE }}
          >
            Chinatown
          </motion.div>
          <motion.div
            className="s1-label l2"
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 2.05, ease: FILM_EASE }}
          >
            Little India
          </motion.div>
          <motion.div
            className="s1-label l3"
            initial={{ opacity: 0, scale: 0.86, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 2.4, ease: FILM_EASE }}
          >
            Mustafa Centre
          </motion.div>
        </div>
      </div>
      <CarryDot />
    </motion.section>
  );
}