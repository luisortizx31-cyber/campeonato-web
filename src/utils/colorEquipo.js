// Colores fijos de la paleta del tema, elegidos por hash del nombre -
// muchos torneos usan nombres de equipo que comparten la misma
// inicial (ej. "Promo 2000/2001/2002"), asi que el color es lo que
// realmente distingue un escudo/badge de otro de un vistazo, no la
// letra sola.
const COLORES_EQUIPO = [
  { bg: 'bg-brand-soft', text: 'text-brand' },
  { bg: 'bg-gold-soft', text: 'text-gold' },
  { bg: 'bg-success-soft', text: 'text-success' },
  { bg: 'bg-warning-soft', text: 'text-warning' },
  { bg: 'bg-danger-soft', text: 'text-danger' },
]

export function colorEquipo(nombre) {
  let hash = 0
  for (let i = 0; i < (nombre?.length || 0); i++) {
    hash = (hash * 31 + nombre.charCodeAt(i)) | 0
  }
  return COLORES_EQUIPO[Math.abs(hash) % COLORES_EQUIPO.length]
}

export function inicialEquipo(nombre) {
  return nombre?.trim()?.charAt(0)?.toUpperCase() || '—'
}
