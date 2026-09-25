// Calculo puro de la tabla de posiciones de una categoria, a partir
// de los equipos inscritos y los partidos ya cargados. No toca
// Firestore: se llama despues de traer ambas listas (ver
// TablaPosicionesCategoria.jsx), igual que los totales por
// comisionista en TabComisionistas.jsx - se recalcula en cada carga
// en vez de guardar un contador, para que nunca pueda desincronizarse
// de los resultados reales.
import { estadoPartido } from './partidosPorDia'

const PUNTOS_POR_RESULTADO = { gana: 3, empata: 1, pierde: 0 }

// Con `incluirEnVivo` los partidos que se estan jugando (arrancados y sin
// resultado final, ver estadoPartido) cuentan con su marcador ACTUAL
// (golesLocalEnVivo / golesVisitanteEnVivo, 0-0 si todavia no hay goles)
// como si fuera el resultado final: ganando va 3 puntos, empatando 1 y
// perdiendo 0, y la tabla se mueve gol a gol. Es provisional - cuando el
// partido se finaliza pasa a contar con su resultado definitivo - y los
// equipos involucrados salen con `enVivo: true` para marcarlos. Sin la
// opcion (por defecto) solo cuentan los partidos terminados.
export function calcularTablaPosiciones({ equipos, partidos, ajustes = [], incluirEnVivo = false, ahora = Date.now() }) {
  const filasPorEquipo = new Map(
    equipos.map((e) => [
      e.id,
      {
        equipoId: e.id,
        nombre: e.nombre,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
        ajustePts: 0,
        enVivo: false,
      },
    ])
  )

  for (const partido of partidos) {
    // Partidos del fixture generado (ver torneoPartidosService.generarFixture)
    // que todavia no tienen resultado cargado no cuentan para la tabla
    // (salvo, si se pidio, los que se estan jugando ahora mismo).
    const terminado = partido.golesLocal != null && partido.golesVisitante != null
    const enJuego = incluirEnVivo && !terminado && estadoPartido(partido, ahora) === 'vivo'
    if (!terminado && !enJuego) continue

    const local = filasPorEquipo.get(partido.equipoLocalId)
    const visitante = filasPorEquipo.get(partido.equipoVisitanteId)
    // Si algun equipo del partido ya no existe (fue eliminado), el
    // partido se ignora para la tabla en vez de romper el calculo.
    if (!local || !visitante) continue

    const golesLocal = (terminado ? partido.golesLocal : partido.golesLocalEnVivo) ?? 0
    const golesVisitante = (terminado ? partido.golesVisitante : partido.golesVisitanteEnVivo) ?? 0
    if (enJuego) {
      local.enVivo = true
      visitante.enVivo = true
    }

    local.pj += 1
    visitante.pj += 1
    local.gf += golesLocal
    local.gc += golesVisitante
    visitante.gf += golesVisitante
    visitante.gc += golesLocal

    if (golesLocal > golesVisitante) {
      local.pg += 1
      local.pts += PUNTOS_POR_RESULTADO.gana
      visitante.pp += 1
      visitante.pts += PUNTOS_POR_RESULTADO.pierde
    } else if (golesLocal < golesVisitante) {
      visitante.pg += 1
      visitante.pts += PUNTOS_POR_RESULTADO.gana
      local.pp += 1
      local.pts += PUNTOS_POR_RESULTADO.pierde
    } else {
      local.pe += 1
      visitante.pe += 1
      local.pts += PUNTOS_POR_RESULTADO.empata
      visitante.pts += PUNTOS_POR_RESULTADO.empata
    }
  }

  // Ajustes manuales (bonificaciones/sanciones, ver torneoAjustesService)
  // - se suman aparte de los puntos por resultado, y se guarda el total
  // en ajustePts para poder mostrar "de donde salen" en la tabla.
  for (const ajuste of ajustes) {
    const fila = filasPorEquipo.get(ajuste.equipoId)
    if (fila) fila.ajustePts += ajuste.puntos
  }

  const filas = [...filasPorEquipo.values()]
  for (const fila of filas) {
    fila.dg = fila.gf - fila.gc
    fila.pts += fila.ajustePts
  }

  filas.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (b.dg !== a.dg) return b.dg - a.dg
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.nombre.localeCompare(b.nombre)
  })

  return filas
}
