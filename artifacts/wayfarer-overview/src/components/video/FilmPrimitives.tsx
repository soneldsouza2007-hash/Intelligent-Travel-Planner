import { Map } from 'lucide-react';

export const FILM_EASE = [0.22, 1, 0.36, 1] as const;

export function MapMark({ className = '' }: { className?: string }) {
  return (
    <div className={`map-mark ${className}`} aria-hidden="true">
      <Map size="54%" strokeWidth={1.7} />
    </div>
  );
}

export function CarryDot() {
  return <span className="film-carry-dot" aria-hidden="true" />;
}