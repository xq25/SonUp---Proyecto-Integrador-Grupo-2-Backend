/** Zona horaria de la fundación: define qué día es "hoy" en las reglas de negocio. */
export const APP_TIME_ZONE = "America/Bogota";

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la fundación. */
export function todayIsoDate(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

/** Día (YYYY-MM-DD) en la zona horaria de la fundación al que pertenece un instante. */
export function dayInAppTimeZone(instant: Date): string {
  return todayIsoDate(instant);
}

/**
 * Inicio (inclusivo) y fin (exclusivo) de un día de la fundación.
 * Colombia no tiene horario de verano: el desfase es siempre UTC−5.
 */
export function appDayRange(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00-05:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** Fecha de una columna `date` (llega como medianoche UTC) en formato YYYY-MM-DD. */
export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
