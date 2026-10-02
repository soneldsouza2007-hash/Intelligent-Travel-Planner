import { motion } from 'framer-motion';

import { CarryDot, FILM_EASE } from '../FilmPrimitives';

const stopPositions = [
  { left: '9%', top: '66%' },
  { left: '32%', top: '31%' },
  { left: '59%', top: '52%' },
  { left: '85%', top: '20%' },
];

export function Scene3() {
  return (
    <motion.section
      className="film-scene s3"
      initial={{ opacity: 0.52, scale: 0.96, rotate: -1.2 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 1.07, rotate: 1.2 }}
      transition={{ duration: 0.48, ease: FILM_EASE }}
    >
      <div className="s3-topline">
        <span>Wayfarer / Itinerary</span>
        <span>Destination-specific</span>
      </div>

      <motion.h2
        className="s3-title"
        initial={{ opacity: 0.45, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.03, ease: FILM_EASE }}
      >
        The itinerary
        <br />
        rebuilds<em>.</em>
      </motion.h2>

      <div className="s3-map" aria-hidden="true">
        <svg className="s3-route" viewBox="0 0 600 330" preserveAspectRatio="none">
          <motion.path
            d="M 36 244 C 121 225 145 101 232 108 C 308 115 319 221 391 201 C 478 176 460 70 566 60"
            pathLength={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.55, delay: 0.32, ease: FILM_EASE }}
          />
        </svg>
        {stopPositions.map((position, index) => (
          <motion.span
            key={index}
            className="s3-map-dot"
            style={position}
            initial={{ opacity: 0, scale: 0.15 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.36, delay: 0.55 + index * 0.35, ease: FILM_EASE }}
          />
        ))}
      </div>

      <motion.div
        className="s3-caption"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 3.35, ease: FILM_EASE }}
      >
        Unique stops. Built around this city.
      </motion.div>

      <motion.div
        className="s3-rail"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.54, delay: 1.4, ease: FILM_EASE }}
      >
        <span className="s3-rail-title">Day by day</span>
        {[1, 2, 3, 4].map((stop, index) => (
          <motion.span
            key={stop}
            className="s3-stop"
            initial={{ opacity: 0, scale: 0.84, y: 9 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 1.8 + index * 0.28, ease: FILM_EASE }}
          >
            Stop 0{stop}
          </motion.span>
        ))}
      </motion.div>
      <CarryDot />
    </motion.section>
  );
}