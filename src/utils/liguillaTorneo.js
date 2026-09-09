// Matematica del cuadro eliminatorio (liguilla) - funciones puras, no
// tocan Firestore (mismo criterio que fixtureTorneo.js, que arma el
// fixture de la temporada regular). Las usa TabLiguilla.jsx para
// mostrar la vista previa editable antes de confirmar cada ronda.
//
// En todas estas funciones un equipo es simplemente su equipoId
// (string) - la posicion en la tabla se pasa aparte como un Map
// (posicionPorEquipo) donde hace falta para desempatar, en vez de ir
// arrastrando un objeto {equipoId, posicion} por todos lados.
//
// Mecanica (confirmada con el Maestro):
// 1. Los clasificados vienen ya ordenados mejor->peor (posicion en la
//    Tabla de Posiciones, ya determinista: pts -> dif. gol -> goles a
//    favor -> alfabetico).
// 2. Ronda 1 sembrada (no sorteada): 1° vs ultimo, 2° vs anteultimo,
//    etc. Si la cantidad de clasificados es impar, el 1° pasa directo
//    (bye) y el resto (que ya queda par) se empareja igual entre si.
// 3. Terminada una ronda, si ganadores + bye no completan una potencia
//    de 2, se suman los mejores ubicados (por su posicion ORIGINAL en
//    la tabla) entre los que perdieron esa ronda, hasta completarla
//    ("mejor perdedor").
// 4. Con el grupo ya en potencia de 2, se sortea el cruce de la
//    siguiente ronda. Se repite hasta que queden 2 equipos (la Final).

// La potencia de 2 mas chica que sea >= n. Con n<=1 devuelve 1 (no
// hace falta ninguna ronda mas: ya hay un campeon o nadie clasifico).
export function siguientePotenciaDeDos(n) {
  if (n <= 1) return 1
  let p = 1
  while (p < n) p *= 2
  return p
}

// Nombre de la ronda segun cuantos equipos ENTRAN a jugarla (incluye
// al que tiene bye en la Ronda 1). Solo la Ronda 1 puede no ser
// potencia de 2 (2/4/8/16) - de la Ronda 2 en adelante el grupo que
// avanza siempre llega ya redondeado (ver calcularGrupoQueAvanza), asi
// que el "Ronda de N" generico en la practica solo se ve en la Ronda 1
// con cantidades como 5, 6, 7 o 9 clasificados.
export function nombreRonda(numEquipos) {
  switch (numEquipos) {
    case 2:
      return 'Final'
    case 4:
      return 'Semifinal'
    case 8:
      return 'Cuartos de final'
    case 16:
      return 'Octavos de final'
    default:
      return `Ronda de ${numEquipos}`
  }
}

// Arma los cruces de la Ronda 1 a partir de los equipoIds clasificados
// (ya ordenados mejor->peor). Con cantidad impar, el mejor ubicado
// (indice 0) pasa directo y el resto se empareja mejor-contra-peor
// entre si. Devuelve { bye: equipoId|null, cruces: [[idA, idB], ...] }.
export function armarCrucesRonda1(qualifierIds) {
  const n = qualifierIds.length
  let bye = null
  let lista = qualifierIds
  if (n % 2 !== 0) {
    bye = qualifierIds[0]
    lista = qualifierIds.slice(1)
  }
  const cruces = []
  for (let i = 0; i < lista.length / 2; i++) {
    cruces.push([lista[i], lista[lista.length - 1 - i]])
  }
  return { bye, cruces }
}

// Fisher-Yates - no muta el array que recibe.
export function barajarArray(array) {
  const copia = [...array]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

// Sortea los cruces de una ronda (2+) - a diferencia de la Ronda 1,
// esta es al azar, no sembrada. `equipoIds` tiene que venir ya en
// cantidad potencia de 2 (lo garantiza calcularGrupoQueAvanza antes).
export function sortearCruces(equipoIds) {
  const barajados = barajarArray(equipoIds)
  const cruces = []
  for (let i = 0; i < barajados.length; i += 2) {
    cruces.push([barajados[i], barajados[i + 1]])
  }
  return cruces
}

// El mecanismo de "mejor perdedor": quienes avanzan a la siguiente
// ronda son los ganadores + el que tuvo bye (si hubo), completado con
// los perdedores mejor ubicados (en la tabla ORIGINAL, no en esta
// ronda) hasta llegar a una potencia de 2. `ganadores`/`perdedores`
// son arrays de equipoId, `bye` es un equipoId o null,
// `posicionPorEquipo` es un Map equipoId -> posicion (0-based, mejor
// primero).
//
// Nota: esto solo puede necesitar comodines despues de la Ronda 1 - la
// mitad de una potencia de 2 sigue siendo potencia de 2, asi que de la
// Ronda 2 en adelante "faltan" siempre da 0. Se llama igual todas las
// rondas por uniformidad (reconstruirBracket no necesita saber en que
// ronda esta para decidir si hace falta comodin o no).
export function calcularGrupoQueAvanza({ ganadores, perdedores, bye, posicionPorEquipo }) {
  const avanzanBase = bye ? [...ganadores, bye] : [...ganadores]
  const objetivo = siguientePotenciaDeDos(avanzanBase.length)
  const faltan = objetivo - avanzanBase.length
  if (faltan <= 0) return { avanzan: avanzanBase, comodines: [] }

  const perdedoresOrdenados = [...perdedores].sort(
    (a, b) => (posicionPorEquipo.get(a) ?? Infinity) - (posicionPorEquipo.get(b) ?? Infinity)
  )
  const comodines = perdedoresOrdenados.slice(0, faltan)
  return { avanzan: [...avanzanBase, ...comodines], comodines }
}

// Ganador/perdedor de cada partido de una ronda, a partir de los docs
// de /torneo_partidos ya guardados. Un partido sin marcador cargado
// todavia deja la ronda incompleta. Un empate (golesLocal ===
// golesVisitante) tambien la deja incompleta hasta que el Maestro
// defina a mano quien avanza (ver ganadorId, torneoLiguillaService).
export function resolverResultadosRonda(partidosRonda) {
  const ganadores = []
  const perdedores = []
  let completa = true
  for (const p of partidosRonda) {
    if (p.golesLocal == null || p.golesVisitante == null) {
      completa = false
      continue
    }
    let ganadorId
    if (p.golesLocal > p.golesVisitante) ganadorId = p.equipoLocalId
    else if (p.golesVisitante > p.golesLocal) ganadorId = p.equipoVisitanteId
    else ganadorId = p.ganadorId || null
    if (!ganadorId) {
      completa = false
      continue
    }
    ganadores.push(ganadorId)
    perdedores.push(ganadorId === p.equipoLocalId ? p.equipoVisitanteId : p.equipoLocalId)
  }
  return { completa, ganadores, perdedores }
}

// Reconstruye TODO el estado del cuadro a partir de los partidos
// guardados - mismo criterio que calcularTablaPosiciones: nunca se
// guarda estado derivado, se recalcula siempre desde Firestore. Una
// ronda = un fechaNumero (ver torneoLiguillaService). `qualifiers` es
// el snapshot congelado ({equipoId, posicion}[]) guardado al iniciar
// la liguilla.
export function reconstruirBracket({ qualifiers, byeEquipoId, partidosLiguilla }) {
  const posicionPorEquipo = new Map(qualifiers.map((q) => [q.equipoId, q.posicion]))
  const fechas = [...new Set(partidosLiguilla.map((p) => p.fechaNumero))].sort((a, b) => a - b)

  const rondas = []
  let entrantesRondaActual = qualifiers.length

  for (let i = 0; i < fechas.length; i++) {
    const fechaNumero = fechas[i]
    const partidosRonda = partidosLiguilla.filter((p) => p.fechaNumero === fechaNumero)
    const byeDeEstaRonda = i === 0 ? byeEquipoId : null

    const { completa, ganadores, perdedores } = resolverResultadosRonda(partidosRonda)
    let avanzan = []
    let comodines = []
    if (completa) {
      ;({ avanzan, comodines } = calcularGrupoQueAvanza({
        ganadores,
        perdedores,
        bye: byeDeEstaRonda,
        posicionPorEquipo,
      }))
    }

    rondas.push({
      fechaNumero,
      nombreRonda: partidosRonda[0]?.jornada || nombreRonda(entrantesRondaActual),
      partidos: partidosRonda,
      bye: byeDeEstaRonda,
      completa,
      ganadores,
      perdedores,
      comodines,
      avanzan,
    })
    entrantesRondaActual = avanzan.length
  }

  const ultimaRonda = rondas[rondas.length - 1]
  let equiposVivos
  if (!ultimaRonda) {
    equiposVivos = qualifiers.map((q) => q.equipoId)
  } else if (ultimaRonda.completa) {
    equiposVivos = ultimaRonda.avanzan
  } else {
    equiposVivos = null // la ultima ronda todavia esta en curso
  }
  const campeonEquipoId = equiposVivos && equiposVivos.length === 1 ? equiposVivos[0] : null

  return { rondas, equiposVivos, campeonEquipoId }
}
