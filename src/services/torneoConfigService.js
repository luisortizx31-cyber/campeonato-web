import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import {
  UMBRAL_SUSPENSION_AMARILLAS_DEFAULT,
  JUGADORES_POR_EQUIPO_DEFAULT,
  DIFERENCIA_WALKOVER_DEFAULT,
  CATEGORIAS_ACTIVAS_DEFAULT,
} from '../models/torneo'

const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024

// torneo_config es una coleccion compartida entre todos los tenants,
// asi que el id del documento tiene que incluir el torneoId para que
// dos torneos no pisen la config del otro.
function idConfigGeneral(torneoId) {
  return `${torneoId}_general`
}
function idConfigCategoria(torneoId, categoria) {
  return `${torneoId}_${categoria}`
}

// Sube el PDF de bases del torneo a una ruta fija por tenant (se
// sobreescribe en cada subida, no hay historial de versiones - un solo
// campeonato continuo por torneoId). A diferencia de
// storageService.subirFotoDni, no hay compresion: es un PDF, no una
// imagen.
export async function subirBases(torneoId, file) {
  if (file.type !== 'application/pdf') {
    throw new Error('Las bases deben subirse en formato PDF.')
  }
  if (file.size > TAMANO_MAXIMO_BYTES) {
    throw new Error('El archivo no puede pesar mas de 10 MB.')
  }

  const fileRef = ref(storage, `torneo/${torneoId}/bases.pdf`)
  await uploadBytes(fileRef, file, { contentType: file.type })
  const basesUrl = await getDownloadURL(fileRef)

  await setDoc(doc(db, 'torneo_config', idConfigGeneral(torneoId)), {
    torneoId,
    basesUrl,
    basesNombreArchivo: file.name,
    basesSubidoEn: serverTimestamp(),
  })

  return basesUrl
}

export async function obtenerConfigTorneo(torneoId) {
  const snap = await getDoc(doc(db, 'torneo_config', idConfigGeneral(torneoId)))
  if (!snap.exists()) {
    return { basesUrl: null, basesNombreArchivo: null, basesSubidoEn: null, categoriasActivas: CATEGORIAS_ACTIVAS_DEFAULT }
  }
  const data = snap.data()
  return { ...data, categoriasActivas: data.categoriasActivas || CATEGORIAS_ACTIVAS_DEFAULT }
}

// Categorias que este torneo realmente usa (subconjunto de
// CATEGORIAS_TORNEO_DISPONIBLES, ver models/torneo) - el resto de la
// app (panel admin y pagina publica) solo ofrece un selector para
// estas. Es una decision de todo el torneo, no por categoria, por eso
// vive en el doc "general" junto a basesUrl.
export async function actualizarCategoriasActivas(torneoId, categorias) {
  if (!Array.isArray(categorias) || categorias.length === 0) {
    throw new Error('Debe quedar seleccionada al menos una categoría.')
  }
  await setDoc(
    doc(db, 'torneo_config', idConfigGeneral(torneoId)),
    { torneoId, categoriasActivas: categorias },
    { merge: true }
  )
}

// Umbrales de disciplina guardados por torneo+categoria - separado del
// doc "general" de las bases porque cada categoria puede tener su
// propio reglamento.
//  - umbralAmarillas: amarillas acumuladas que disparan suspension.
//  - umbralRojas: veces que un jugador puede ser suspendido por roja
//    directa antes de quedar eliminado del campeonato. null/undefined
//    significa "sin eliminacion automatica" (comportamiento por defecto).
//  - equiposEliminados: cuantos equipos, contados desde el ultimo
//    lugar de la tabla de posiciones, quedan afuera del campeonato -
//    el resto son los que "pasan". 0 significa que no hay corte
//    (comportamiento por defecto). Es solo visual (linea de corte en
//    TablaPosicionesCategoria), no bloquea nada del fixture.
//  - jugadoresPorEquipo: formato del partido (futbol 6, 7 u 11) - se
//    usa en ControlPartido para mostrar cuantos titulares corresponde
//    marcar, solo como guia (no bloquea si hace falta jugar con menos).
//  - minimoJugadoresCancha: si un equipo queda con MENOS jugadores en
//    cancha que este numero (por expulsiones), ControlPartido avisa
//    que se puede cerrar el partido por walkover. null significa que
//    la regla no aplica (comportamiento por defecto, ningun partido
//    se corta solo por quedar con pocos jugadores).
//  - diferenciaWalkover: el marcador FIJO (ej. 3-0) con el que se
//    cierra el partido cuando se confirma el walkover de arriba - no
//    se suma a los goles ya metidos.
//  - maximoJugadoresInscritos: tope de jugadores ACTIVOS por equipo en
//    esta categoria - ModalRegistrarJugador bloquea el alta de un
//    jugador nuevo (o el pase a otro equipo) si ya se llego al tope.
//    null significa que no hay tope (comportamiento por defecto).
export async function obtenerConfigCategoria(torneoId, categoria) {
  const snap = await getDoc(doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)))
  const data = snap.exists() ? snap.data() : {}
  return {
    umbralAmarillas: data.umbralAmarillas || UMBRAL_SUSPENSION_AMARILLAS_DEFAULT,
    umbralRojas: data.umbralRojas || null,
    equiposEliminados: data.equiposEliminados || 0,
    jugadoresPorEquipo: data.jugadoresPorEquipo || JUGADORES_POR_EQUIPO_DEFAULT,
    minimoJugadoresCancha: data.minimoJugadoresCancha || null,
    diferenciaWalkover: data.diferenciaWalkover || DIFERENCIA_WALKOVER_DEFAULT,
    maximoJugadoresInscritos: data.maximoJugadoresInscritos || null,
  }
}

export async function actualizarUmbralAmarillas(torneoId, categoria, umbral) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, umbralAmarillas: Number(umbral) },
    { merge: true }
  )
}

export async function actualizarUmbralRojas(torneoId, categoria, umbral) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, umbralRojas: umbral ? Number(umbral) : null },
    { merge: true }
  )
}

export async function actualizarEquiposEliminados(torneoId, categoria, cantidad) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, equiposEliminados: Number(cantidad) || 0 },
    { merge: true }
  )
}

export async function actualizarJugadoresPorEquipo(torneoId, categoria, cantidad) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, jugadoresPorEquipo: Number(cantidad) || JUGADORES_POR_EQUIPO_DEFAULT },
    { merge: true }
  )
}

export async function actualizarMinimoJugadoresCancha(torneoId, categoria, cantidad) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, minimoJugadoresCancha: cantidad ? Number(cantidad) : null },
    { merge: true }
  )
}

export async function actualizarDiferenciaWalkover(torneoId, categoria, cantidad) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, diferenciaWalkover: Number(cantidad) || DIFERENCIA_WALKOVER_DEFAULT },
    { merge: true }
  )
}

export async function actualizarMaximoJugadoresInscritos(torneoId, categoria, cantidad) {
  await setDoc(
    doc(db, 'torneo_config', idConfigCategoria(torneoId, categoria)),
    { torneoId, maximoJugadoresInscritos: cantidad ? Number(cantidad) : null },
    { merge: true }
  )
}
