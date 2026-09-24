import { useEffect, useState } from 'react'

// Cronometro en vivo de un tiempo del partido (ver
// torneoPartidosService.PERIODOS_PARTIDO y CronometroPeriodo). Mientras
// esta en curso (inicio sin fin) tiquea cada segundo; una vez terminado
// se queda fijo en la duracion real (fin - inicio); si todavia no
// arranco, en 0. `datos` es el campo tal cual viene del doc del
// partido: { duracionMin, inicio, fin } (Timestamps de Firestore) o
// null/undefined si ese tiempo nunca se inicio.
export function useCronometro(datos) {
  const inicioMs = datos?.inicio?.toMillis?.() ?? null
  const finMs = datos?.fin?.toMillis?.() ?? null
  const activo = inicioMs != null && finMs == null

  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    if (!activo) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [activo])

  if (inicioMs == null) {
    return { segundos: 0, activo: false, terminado: false }
  }
  const hastaMs = finMs ?? ahora
  return {
    segundos: Math.max(0, Math.floor((hastaMs - inicioMs) / 1000)),
    activo,
    terminado: finMs != null,
  }
}
