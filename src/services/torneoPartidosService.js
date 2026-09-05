import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { generarRondas } from '../utils/fixtureTorneo'
import { listarGolesPorPartido, eliminarGol } from './torneoGolesService'
import { listarTarjetasPorPartido, eliminarTarjeta } from './torneoTarjetasService'

// Los partidos del fixture generado no tienen `fecha` real (no hay
// calendario en la app), asi que se ordenan por fechaNumero cuando
// `fecha` no alcanza para desempatar. Se usa tanto en la lectura unica
// (listarPartidosPorCategoria) como en la suscripcion en vivo
// (suscribirPartidosPorCategoria) para que ambas queden ordenadas igual.
function ordenarPartidos(partidos) {
  return [...partidos].sort((a, b) => {
    const fechaA = a.fecha?.toMillis?.() || 0
    const fechaB = b.fecha?.toMillis?.() || 0
    if (fechaA !== fechaB) return fechaB - fechaA
    return (b.fechaNumero || 0) - (a.fechaNumero || 0)
  })
}

export async function listarPartidosPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_partidos'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  return ordenarPartidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
}

// Igual que listarPartidosPorCategoria pero en tiempo real - la usa la
// pagina publica (ver TabFechasPublica) para que el marcador en vivo
// (ver actualizarMarcadorEnVivo) se actualice solo en la pantalla de
// quien esta mirando, sin que tenga que refrescar. Devuelve la funcion
// para cancelar la suscripcion (llamarla al desmontar/cambiar de
// categoria).
export function suscribirPartidosPorCategoria(torneoId, categoria, onCambio) {
  const q = query(
    collection(db, 'torneo_partidos'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  return onSnapshot(q, (snap) => {
    onCambio(ordenarPartidos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
  })
}

// Genera el fixture completo "todos contra todos" de una categoria
// (ver utils/fixtureTorneo.generarRondas) y crea un partido SIN
// resultado (golesLocal/golesVisitante null) por cada enfrentamiento.
// Se bloquea si ya hay partidos en la categoria, para no mezclar dos
// fixtures o duplicar partidos - hay que reiniciar (eliminarFixture)
// primero.
export async function generarFixture({ torneoId, categoria, equipoIds, idaYVuelta }) {
  if (equipoIds.length < 2) {
    throw new Error('Se necesitan al menos 2 equipos para generar el fixture.')
  }

  const existentes = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria)
    )
  )
  if (!existentes.empty) {
    throw new Error('Ya hay partidos en esta categoria. Elimina el fixture actual antes de generar uno nuevo.')
  }

  const rondas = generarRondas(equipoIds, idaYVuelta)

  const batch = writeBatch(db)
  rondas.forEach((partidosRonda, indice) => {
    const fechaNumero = indice + 1
    partidosRonda.forEach(([equipoLocalId, equipoVisitanteId]) => {
      const ref = doc(collection(db, 'torneo_partidos'))
      batch.set(ref, {
        torneoId,
        categoria,
        equipoLocalId,
        equipoVisitanteId,
        golesLocal: null,
        golesVisitante: null,
        fecha: null,
        jornada: `Fecha ${fechaNumero}`,
        fechaNumero,
        creadoEn: serverTimestamp(),
      })
    })
  })
  await batch.commit()

  return rondas.length
}

// Agrega un solo partido a una fecha (existente o nueva) a mano, sin
// pasar por generarFixture - para cuando el campeonato ya arranco con
// un sorteo hecho por fuera y el Maestro quiere cargar los cruces
// reales fecha a fecha en vez de usar el "todos contra todos"
// automatico. El resultado es opcional: si no se pasa, el partido
// queda pendiente igual que uno generado automaticamente.
export async function agregarPartidoManual({ torneoId, categoria, fechaNumero, equipoLocalId, equipoVisitanteId, golesLocal, golesVisitante }) {
  if (equipoLocalId === equipoVisitanteId) {
    throw new Error('El equipo local y el visitante no pueden ser el mismo.')
  }

  // Un equipo no puede tener dos partidos en la misma fecha - se
  // valida tambien aca (ademas de deshabilitarse en el selector del
  // modal) por si la lista de partidos que tenia cargada el formulario
  // quedo desactualizada.
  const fechaNum = Number(fechaNumero)
  const existentesSnap = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria),
      where('fechaNumero', '==', fechaNum)
    )
  )
  const ocupados = new Set(existentesSnap.docs.flatMap((d) => [d.data().equipoLocalId, d.data().equipoVisitanteId]))
  if (ocupados.has(equipoLocalId) || ocupados.has(equipoVisitanteId)) {
    throw new Error('Uno de los dos equipos ya tiene un partido programado en esa fecha.')
  }

  const tieneResultado = golesLocal !== '' && golesLocal != null && golesVisitante !== '' && golesVisitante != null

  const ref = await addDoc(collection(db, 'torneo_partidos'), {
    torneoId,
    categoria,
    equipoLocalId,
    equipoVisitanteId,
    golesLocal: tieneResultado ? Number(golesLocal) : null,
    golesVisitante: tieneResultado ? Number(golesVisitante) : null,
    fecha: null,
    jornada: `Fecha ${fechaNumero}`,
    fechaNumero: Number(fechaNumero),
    creadoEn: serverTimestamp(),
  })

  return ref.id
}

// Carga (o corrige) el resultado de un partido del fixture. No toca
// fecha/jornada - esos ya vienen fijados por generarFixture o
// agregarPartidoManual.
export async function registrarResultadoPartido(partidoId, { golesLocal, golesVisitante }) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    golesLocal: Number(golesLocal),
    golesVisitante: Number(golesVisitante),
    golesLocalEnVivo: null,
    golesVisitanteEnVivo: null,
  })
}

// Marcador "en vivo" (parcial, mientras el partido todavia no se
// finaliza) - lo llama ControlPartido cada vez que cambia un gol,
// asi Fechas y la pagina publica pueden mostrar el resultado sin
// esperar a "Finalizar partido". No cuenta para nada mas (tabla de
// posiciones, goleadores): eso sigue dependiendo solo de
// golesLocal/golesVisitante, los definitivos.
export async function actualizarMarcadorEnVivo(partidoId, { golesLocal, golesVisitante }) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    golesLocalEnVivo: golesLocal,
    golesVisitanteEnVivo: golesVisitante,
  })
}

// Vuelve el RESULTADO de un partido puntual a Pendiente - ver
// ControlPartido, boton "Reiniciar partido". No toca la alineacion
// (titulares, suplentes, DNI confirmado): queda tal cual, para no
// tener que volver a armarla si lo que estaba mal era solo el
// marcador. Tampoco toca goles ni tarjetas: esos si pueden tener
// efectos ya aplicados en el jugador que hay que revertir por su
// cuenta (ver eliminarGol/eliminarTarjeta), asi que los borra quien
// llama a esta funcion antes de invocarla.
export async function reiniciarPartido(partidoId) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    golesLocal: null,
    golesVisitante: null,
    golesLocalEnVivo: null,
    golesVisitanteEnVivo: null,
  })
}

// Reinicio completo de UN partido puntual: borra sus goles y tarjetas
// (revirtiendo el efecto de las que ya estaban procesadas, ver
// eliminarTarjeta) y vuelve el resultado a Pendiente - la alineacion
// (titulares, suplentes, DNI confirmado) no se toca. La usan tanto
// ControlPartido ("↺ Reiniciar goles y tarjetas") como el icono de
// reiniciar de cada partido en Fechas, para no duplicar esta logica
// (que involucra revertir contadores de tarjetas) en dos lugares.
export async function reiniciarPartidoCompleto(partidoId) {
  const [goles, tarjetas] = await Promise.all([
    listarGolesPorPartido(partidoId),
    listarTarjetasPorPartido(partidoId),
  ])
  for (const g of goles) {
    await eliminarGol(g.id)
  }
  for (const t of tarjetas) {
    await eliminarTarjeta(t.id)
  }
  await reiniciarPartido(partidoId)
}

// Dia/hora programado de UN partido puntual - reutiliza el campo
// `fecha` que ya existia en el doc (Timestamp, hasta ahora siempre
// null: generarFixture/agregarPartidoManual nunca lo llenaban).
// `fechaHora` es un Date de JS (Firestore lo convierte solo a
// Timestamp al escribir) o null para borrar la programacion.
export async function actualizarFechaProgramada(partidoId, fechaHora) {
  await updateDoc(doc(db, 'torneo_partidos', partidoId), { fecha: fechaHora })
}

// Reprograma una Fecha completa (por suspension, ej. lluvia) y corre
// TODAS las fechas siguientes que ya tenian dia puesto la misma
// cantidad de dias/horas - el calendario pendiente se desplaza entero
// por igual, no se "encadena" al dia que tenia anotado la siguiente
// fecha (eso dejaria los espacios entre fechas desparejos). Si la
// Fecha que se reprograma no tenia ningun dia puesto todavia, no hay
// de donde calcular un desplazamiento: se le asigna la nueva fecha y
// no se toca ninguna otra. Solo mueve partidos NO jugados - uno ya
// jugado conserva su fecha real como registro historico.
export async function reprogramarFecha(torneoId, categoria, fechaNumero, nuevaFechaBase) {
  const partidos = await listarPartidosPorCategoria(torneoId, categoria)
  const noJugados = partidos.filter((p) => p.golesLocal == null)
  const deLaFecha = noJugados.filter((p) => p.fechaNumero === fechaNumero && p.fecha)

  const batch = writeBatch(db)

  if (deLaFecha.length === 0) {
    noJugados
      .filter((p) => p.fechaNumero === fechaNumero)
      .forEach((p) => batch.update(doc(db, 'torneo_partidos', p.id), { fecha: nuevaFechaBase }))
    await batch.commit()
    return
  }

  const fechaViejaMs = Math.min(...deLaFecha.map((p) => p.fecha.toMillis()))
  const deltaMs = nuevaFechaBase.getTime() - fechaViejaMs

  noJugados
    .filter((p) => p.fechaNumero >= fechaNumero && p.fecha)
    .forEach((p) => batch.update(doc(db, 'torneo_partidos', p.id), {
      fecha: new Date(p.fecha.toMillis() + deltaMs),
    }))
  await batch.commit()
}

// Reclamo/protesta que un equipo (o el propio Maestro) quiere dejar
// asentado sobre un partido puntual - texto libre, no dispara ninguna
// logica del sistema (no suspende, no cambia el resultado). Se guarda
// junto con quien lo anoto y cuando, para tener un registro de cuando
// se cargo si hace falta revisarlo despues.
export async function actualizarReclamo(partidoId, texto) {
  const limpio = texto?.trim() || null
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    reclamo: limpio,
    reclamoFecha: limpio ? serverTimestamp() : null,
  })
}

// Marca (o desmarca) a un jugador como titular/suplente de un partido
// puntual (ver ControlPartido) - `equipo` es 'local' o 'visitante',
// elige el array correspondiente sobre el propio doc del partido. Un
// jugador del equipo que no este en NINGUNO de los dos arrays queda en
// "Jugadores" (todavia sin decidir si juega hoy) - a diferencia de
// antes, ya no cae en suplente por defecto: hay que elegirlo a
// proposito, para que Suplentes refleje solo a quienes de verdad se
// convocaron para este partido puntual (el plantel completo del
// equipo puede tener muchos mas jugadores registrados en la temporada
// que los que van a la cancha un dia puntual).
export async function actualizarTitular(partidoId, equipo, jugadorId, esTitular) {
  const campo = equipo === 'local' ? 'titularesLocal' : 'titularesVisitante'
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    [campo]: esTitular ? arrayUnion(jugadorId) : arrayRemove(jugadorId),
  })
}

export async function actualizarSuplente(partidoId, equipo, jugadorId, esSuplente) {
  const campo = equipo === 'local' ? 'suplentesLocal' : 'suplentesVisitante'
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    [campo]: esSuplente ? arrayUnion(jugadorId) : arrayRemove(jugadorId),
  })
}

// Check manual, aparte del DNI que ya se guarda en la ficha del
// jugador (Jugadores -> datos privados): confirma si ESE jugador trajo
// el documento fisico ESTE partido puntual, para el control de
// identidad del dia. No se toca ni se lee de /privado a proposito -
// puede tener el DNI cargado en el sistema y no haberlo traido hoy, o
// al reves.
export async function actualizarDniConfirmado(partidoId, equipo, jugadorId, confirmado) {
  const campo = equipo === 'local' ? 'dniConfirmadoLocal' : 'dniConfirmadoVisitante'
  await updateDoc(doc(db, 'torneo_partidos', partidoId), {
    [campo]: confirmado ? arrayUnion(jugadorId) : arrayRemove(jugadorId),
  })
}

// Vuelve a "Pendiente" (golesLocal/golesVisitante = null) los
// partidos de UNA fecha puntual - a diferencia de eliminarFixture, no
// borra los partidos ni el fixture, solo el marcador ya cargado, para
// que el Maestro pueda corregir una fecha entera sin tener que volver
// a armar los cruces. No toca tarjetas ni sanciones.
export async function reiniciarResultadosFecha(torneoId, categoria, fechaNumero) {
  const snap = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria),
      where('fechaNumero', '==', Number(fechaNumero))
    )
  )
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { golesLocal: null, golesVisitante: null }))
  await batch.commit()
}

// Igual que reiniciarResultadosFecha pero para TODAS las fechas de la
// categoria a la vez: el fixture queda intacto (mismos cruces, mismo
// numero de fecha) pero todos los partidos vuelven a "Pendiente".
// Tampoco toca tarjetas ni sanciones - para eso esta
// reiniciarTemporadaCompleta.
export async function reiniciarResultadosTodasLasFechas(torneoId, categoria) {
  const snap = await getDocs(
    query(
      collection(db, 'torneo_partidos'),
      where('torneoId', '==', torneoId),
      where('categoria', '==', categoria)
    )
  )
  const partidosFixture = snap.docs.filter((d) => d.data().fechaNumero != null)
  if (partidosFixture.length === 0) return

  const batch = writeBatch(db)
  partidosFixture.forEach((d) => batch.update(d.ref, { golesLocal: null, golesVisitante: null }))
  await batch.commit()
}

// Reinicio total de una categoria: borra TODOS sus partidos (con o
// sin fechaNumero, tengan o no resultado) y TODAS sus tarjetas, y deja
// a todos los jugadores de la categoria sin amarillas/rojas ni
// suspension/eliminacion - como si el campeonato de esa categoria
// nunca hubiera arrancado. Los equipos y jugadores registrados NO se
// borran (evita tener que volver a inscribir a todos). A diferencia
// de eliminarFixture, no se bloquea por tener resultados o tarjetas
// cargadas: es la opcion para cuando el Maestro quiere empezar de
// cero sin ir borrando partido por partido.
export async function reiniciarTemporadaCompleta(torneoId, categoria) {
  const [partidosSnap, tarjetasSnap, jugadoresSnap] = await Promise.all([
    getDocs(query(collection(db, 'torneo_partidos'), where('torneoId', '==', torneoId), where('categoria', '==', categoria))),
    getDocs(query(collection(db, 'torneo_tarjetas'), where('torneoId', '==', torneoId), where('categoria', '==', categoria))),
    getDocs(query(collection(db, 'torneo_jugadores'), where('torneoId', '==', torneoId), where('categoria', '==', categoria))),
  ])

  const batch = writeBatch(db)
  partidosSnap.docs.forEach((d) => batch.delete(d.ref))
  tarjetasSnap.docs.forEach((d) => batch.delete(d.ref))
  jugadoresSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      amarillasAcumuladas: 0,
      rojasAcumuladas: 0,
      suspendido: false,
      motivoSuspension: null,
      suspendidoDesde: null,
      fechasSuspension: null,
      eliminado: false,
      motivoEliminacion: null,
    })
  })
  await batch.commit()
}

// Si el partido tiene tarjetas asociadas, se bloquea el borrado: hay
// que eliminarlas primero desde Amonestados para que el contador del
// jugador se corrija por el mismo camino (eliminarTarjeta), en vez de
// dejar un contador desactualizado.
export async function eliminarPartido(partidoId) {
  const tarjetasSnap = await getDocs(
    query(collection(db, 'torneo_tarjetas'), where('partidoId', '==', partidoId))
  )
  if (!tarjetasSnap.empty) {
    throw new Error('Este partido tiene tarjetas registradas. Eliminalas primero en Amonestados.')
  }

  await deleteDoc(doc(db, 'torneo_partidos', partidoId))
}
