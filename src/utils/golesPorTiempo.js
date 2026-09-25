// En que tiempo del partido se metio cada gol: se marca solo al cargarlo
// desde ControlPartido, segun cual de los cronometros (ver
// CronometroPeriodo / torneoPartidosService.PERIODOS_PARTIDO) este
// corriendo en ese momento. Se guarda en el gol como `periodo` (uno de
// los `campo` de abajo) o null si no habia ningun tiempo corriendo (o el
// gol es anterior a esta funcion).
export const TIEMPOS_GOL = [
  { campo: 'primerTiempo', etiqueta: '1er tiempo' },
  { campo: 'segundoTiempo', etiqueta: '2do tiempo' },
  { campo: 'tiempoExtra', etiqueta: 'Tiempo extra' },
]

// El tiempo que esta corriendo ahora (con inicio y todavia sin fin), o
// null si no hay ninguno. `datos` es { primerTiempo, segundoTiempo,
// tiempoExtra } tal cual vienen del doc del partido.
export function periodoEnCurso(datos) {
  const enCurso = TIEMPOS_GOL.find(({ campo }) => datos[campo]?.inicio != null && datos[campo]?.fin == null)
  return enCurso ? enCurso.campo : null
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
