// En que tiempo del partido se metio cada gol: se marca solo al cargarlo
// desde ControlPartido, segun cual de los cronometros (ver
// CronometroPeriodo / torneoPartidosService.PERIODOS_PARTIDO) este
// corriendo en ese momento. Se guarda en el gol como `periodo` (uno de
// los `campo` de abajo) o null si no habia ningun tiempo corriendo (o el
// gol es anterior a esta funcion).
export const TIEMPOS_GOL = [
  { campo: 'primerTiempo', etiqueta: '1er tiempo', etiquetaCorta: '1T' },
  { campo: 'segundoTiempo', etiqueta: '2do tiempo', etiquetaCorta: '2T' },
  { campo: 'tiempoExtra', etiqueta: 'Tiempo extra', etiquetaCorta: 'TE' },
]

// El tiempo que esta corriendo ahora (con inicio y todavia sin fin), o
// null si no hay ninguno. `datos` es { primerTiempo, segundoTiempo,
// tiempoExtra } tal cual vienen del doc del partido.
export function periodoEnCurso(datos) {
  const enCurso = TIEMPOS_GOL.find(({ campo }) => datos[campo]?.inicio != null && datos[campo]?.fin == null)
  return enCurso ? enCurso.campo : null
}

// "1T 12'": cuantos minutos lleva corriendo el tiempo activo ahora mismo,
// para mostrar en los listados de partidos (Fechas, Partidos, Cancha) sin
// tener que abrir el Control para saberlo - tanto del lado del Maestro
// como del publico. null si ningun tiempo esta corriendo (el partido
// puede estar "en vivo" con la alineacion cargada pero sin ningun
// cronometro arrancado todavia, ver ControlPartido).
export function textoMinutoEnCurso(partido, ahora) {
  const campo = periodoEnCurso(partido)
  if (!campo) return null
  const inicioMs = partido[campo]?.inicio?.toMillis?.()
  if (inicioMs == null) return null
  const minutos = Math.max(0, Math.floor((ahora - inicioMs) / 60000))
  const { etiquetaCorta } = TIEMPOS_GOL.find((t) => t.campo === campo)
  return `${etiquetaCorta} ${minutos}'`
}

// Goles de UN jugador agrupados por tiempo: [{ etiqueta, cantidad }] en
// orden 1er tiempo, 2do tiempo, tiempo extra y al final "Sin tiempo" (los
// que no se marcaron). Vacio si ninguno se marco - ahi no hay nada que
// mostrar.
export function desgloseGolesPorTiempo(golesDelJugador) {
  const porCampo = new Map()
  for (const g of golesDelJugador) {
    const clave = g.periodo || null
    porCampo.set(clave, (porCampo.get(clave) || 0) + (g.cantidad || 0))
  }
  const hayAlgunoMarcado = TIEMPOS_GOL.some(({ campo }) => porCampo.has(campo))
  if (!hayAlgunoMarcado) return []

  const filas = TIEMPOS_GOL.filter(({ campo }) => porCampo.has(campo)).map(({ campo, etiqueta }) => ({
    etiqueta,
    cantidad: porCampo.get(campo),
  }))
  if (porCampo.has(null)) filas.push({ etiqueta: 'Sin tiempo', cantidad: porCampo.get(null) })
  return filas
}
