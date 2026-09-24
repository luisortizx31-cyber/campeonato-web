// Formato para el cronometro EN VIVO de un tiempo del partido (ver
// CronometroPeriodo) - mm:ss, sin limite de minutos (un tiempo puede
// pasarse de su duracion configurada y seguir corriendo).
export function formatearCronometro(segundosTotales) {
  const segundos = Math.max(0, Math.floor(segundosTotales))
  const m = Math.floor(segundos / 60)
  const s = segundos % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Formato para el resumen de CUANTO DURO un tiempo ya terminado -
// minutos redondeados, en el mismo estilo informal que el resto de la
// app ("22 min") en vez de mm:ss.
export function formatearDuracionMinutos(ms) {
  const min = Math.round(ms / 60000)
  return `${min} min`
}
