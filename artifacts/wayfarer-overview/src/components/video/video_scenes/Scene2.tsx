import { motion } from 'framer-motion';

import { CarryDot, FILM_EASE } from '../FilmPrimitives';

const places = [
  'Chinatown',
  'Little India',
  'Mustafa Centre',
  'Universal Studios Singapore',
];

const pins = [
  { left: '24%', top: '24%' },
  { left: '67%', top: '30%' },
  { left: '45%', top: '55%' },
  { left: '73%', top: '72%' },
];

export function Scene2() {
  return (
    <motion.section
      className="film-scene s2"
      initial={{ opacity: 0, scale: 1.06, clipPath: 'inset(0 0 100% 0)' }}
      animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, scale: 0.96, clipPath: 'inset(0 100% 0 0)' }}
      transition={{ duration: 0.58, ease: FILM_EASE }}
    >
      <div className="s2-head">
        <motion.p
          className="s2-eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18, ease: FILM_EASE }}
        >
          A city changes. The places do too.
        </motion.p>
        <motion.div
          className="s2-destination"
          initial={{ opacity: 0, scale: 0.92, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28, ease: FILM_EASE }}
        >
          <span>Destination</span>
          <strong>Singapore</strong>
        </motion.div>
        <motion.div
          className="s2-foot"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 2.7, ease: FILM_EASE }}
        >
          Place discovery · refreshed for this city
        </motion.div>
      </div>

      <motion.div
        className="s2-map"
        initial={{ opacity: 0, scale: 1.14, rotate: -6 }}
        animate={{ opacity: 1, scale: 1, rotate: -2 }}
        transition={{ duration: 0.72, delay: 0.12, ease: FILM_EASE }}
        aria-hidden="true"
      >
        {pins.map((pin, index) => (
          <motion.span
            key={index}
            className="s2-map-dot"
            style={pin}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.34, delay: 1.25 + index * 0.24, ease: FILM_EASE }}
          />
        ))}
        <span className="s2-map-caption">Illustrative place map</span>
      </motion.div>

      <div className="s2-places">
        {places.map((place, index) => (
          <motion.div
            key={place}
            className="s2-place"
            initial={{ opacity: 0, x: 28, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.44, delay: 1.35 + index * 0.29, ease: FILM_EASE }}
          >
            <span className="s2-place-num">0{index + 1}</span>
            <span className="s2-place-name">{place}</span>
          </motion.div>
        ))}
      </div>
      <CarryDot />
    </motion.section>
  );
}