import { motion } from 'framer-motion';

import { CarryDot, FILM_EASE } from '../FilmPrimitives';

export function Scene4() {
  return (
    <motion.section
      className="film-scene s4"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)', scale: 0.98 }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0%)', scale: 1 }}
      exit={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)', scale: 1.05 }}
      transition={{ duration: 0.62, ease: FILM_EASE }}
    >
      <div className="s4-layout">
        <div className="s4-copy">
          <motion.p
            className="s4-eyebrow"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.16, ease: FILM_EASE }}
          >
            Estimates, with context
          </motion.p>
          <motion.h2
            className="s4-title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.58, delay: 0.38, ease: FILM_EASE }}
          >
            Budget,
            <br />
            clearly.
          </motion.h2>
          <motion.p
            className="s4-support"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.42, delay: 1.3, ease: FILM_EASE }}
          >
            Planned spend, with unverified prices kept out.
          </motion.p>
        </div>

        <motion.div
          className="s4-panel"
          initial={{ opacity: 0, scale: 0.94, rotateY: -7 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ duration: 0.68, delay: 0.14, ease: FILM_EASE }}
        >
          <div className="s4-meter-head">
            <span>Trip budget estimate</span>
            <span>Known costs</span>
          </div>
          <div className="s4-track">
            <motion.div
              className="s4-track-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.05, delay: 0.85, ease: FILM_EASE }}
            />
          </div>
          <motion.span
            className="s4-included"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 1.45, ease: FILM_EASE }}
          >
            Included in estimate
          </motion.span>

          <motion.div
            className="s4-unknown"
            initial={{ opacity: 0, x: 18, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.48, delay: 2.05, ease: FILM_EASE }}
          >
            <strong>Price not verified</strong>
            <span>Excluded from estimate</span>
          </motion.div>

          <div className="s4-split">
            <motion.div
              className="s4-people"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.42, delay: 3.45, ease: FILM_EASE }}
              aria-label="Selected travelers"
            >
              {['A', 'B', 'C'].map((person, index) => (
                <span className="s4-person" key={person} style={{ zIndex: 3 - index }}>
                  {person}
                </span>
              ))}
            </motion.div>
            <motion.span
              className="s4-split-copy"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 3.75, ease: FILM_EASE }}
            >
              Split trip spend
              <br />
              Equal shares
            </motion.span>
          </div>
        </motion.div>
      </div>
      <CarryDot />
    </motion.section>
  );
}