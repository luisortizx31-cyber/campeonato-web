import {
  collection,
  collectionGroup,
  doc,
  writeBatch,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

// Crea el doc publico del jugador y, en la misma escritura, su doc
// privado con el DNI y el telefono (torneo_jugadores/{id}/privado/datos)
// - ver firestore.rules: esa subcoleccion es la unica forma de guardar
// estos datos sin exponerlos en el link publico del torneo. El
// telefono es igual de sensible que el DNI (dato personal del
// jugador), asi que vive en el mismo doc privado en vez de ser un
// campo publico como numeroCamiseta.
//
// El doc privado tambien guarda torneoId (aunque ya se puede inferir
// del jugador padre) porque las reglas de seguridad necesitan poder
// filtrar la collection group query de /privado (ver
// buscarJugadorPorDni) por tenant sin tener que resolver el padre.
export async function registrarJugador({ torneoId, equipoId, categoria, nombre, numeroCamiseta, dni, telefono }) {
  const jugadorRef = doc(collection(db, 'torneo_jugadores'))
  const batch = writeBatch(db)

  batch.set(jugadorRef, {
    torneoId,
    equipoId,
    categoria,
    nombre: nombre.trim(),
    numeroCamiseta: numeroCamiseta || null,
    amarillasAcumuladas: 0,
    rojasAcumuladas: 0,
    suspendido: false,
    motivoSuspension: null,
    suspendidoDesde: null,
    fechasSuspension: null,
    suspendidoDesdeFecha: null,
    suspendidoHastaFecha: null,
    eliminado: false,
    motivoEliminacion: null,
    creadoEn: serverTimestamp(),
  })

  if (dni?.trim() || telefono?.trim()) {
    batch.set(doc(db, 'torneo_jugadores', jugadorRef.id, 'privado', 'datos'), {
      torneoId,
      dni: dni?.trim() || null,
      telefono: telefono?.trim() || null,
    })
  }

  await batch.commit()
  return jugadorRef.id
}

// Busca si el DNI ya pertenece a un jugador inscrito en este torneo y
// categoria (en cualquier equipo), para no dejar registrarlo dos
// veces. Usa una collection group query sobre /privado (ver
// firestore.rules) en vez de leer el DNI de cada jugador uno por uno.
export async function buscarJugadorPorDni(torneoId, categoria, dni) {
  const dniLimpio = dni?.trim()
  if (!dniLimpio) return null

  const snap = await getDocs(query(collectionGroup(db, 'privado'), where('dni', '==', dniLimpio)))
  for (const privadoDoc of snap.docs) {
    if (privadoDoc.data().torneoId !== torneoId) continue
    const jugadorRef = privadoDoc.ref.parent.parent
    const jugadorSnap = await getDoc(jugadorRef)
    if (jugadorSnap.exists() && jugadorSnap.data().categoria === categoria) {
      return { id: jugadorSnap.id, ...jugadorSnap.data() }
    }
  }
  return null
}

export async function listarJugadoresPorEquipo(equipoId) {
  const q = query(collection(db, 'torneo_jugadores'), where('equipoId', '==', equipoId))
  const snap = await getDocs(q)
  const jugadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  jugadores.sort((a, b) => a.nombre.localeCompare(b.nombre))
  return jugadores
}

export async function listarJugadoresPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_jugadores'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  const jugadores = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  jugadores.sort((a, b) => a.nombre.localeCompare(b.nombre))
  return jugadores
}

// El equipo solo puede cambiar dentro de la misma categoria (el
// formulario filtra el selector de equipo por la categoria ya fijada
// del jugador), asi que "categoria" nunca se toca aca.
export async function actualizarJugador(jugadorId, { equipoId, nombre, numeroCamiseta }) {
  await updateDoc(doc(db, 'torneo_jugadores', jugadorId), {
    equipoId,
    nombre: nombre.trim(),
    numeroCamiseta: numeroCamiseta || null,
  })
}

export async function obtenerDatosPrivadosJugador(jugadorId) {
  const snap = await getDoc(doc(db, 'torneo_jugadores', jugadorId, 'privado', 'datos'))
  if (!snap.exists()) return { dni: null, telefono: null }
  const data = snap.data()
  return { dni: data.dni || null, telefono: data.telefono || null }
}

export async function actualizarDatosPrivadosJugador(jugadorId, { torneoId, dni, telefono }) {
  await setDoc(
    doc(db, 'torneo_jugadores', jugadorId, 'privado', 'datos'),
    { torneoId, dni: dni?.trim() || null, telefono: telefono?.trim() || null },
    { merge: true }
  )
}

// Bloquea el borrado si el jugador ya tiene tarjetas (Amonestados
// necesita poder mostrar el historial completo de un jugador; si se
// permitiera borrar, la tarjeta quedaria apuntando a un jugadorId
// inexistente).
export async function eliminarJugador(jugadorId) {
  const tarjetasSnap = await getDocs(
    query(collection(db, 'torneo_tarjetas'), where('jugadorId', '==', jugadorId))
  )
  if (!tarjetasSnap.empty) {
    throw new Error('Este jugador tiene tarjetas registradas. Eliminalas primero en Amonestados.')
  }

  await deleteDoc(doc(db, 'torneo_jugadores', jugadorId, 'privado', 'datos'))
  await deleteDoc(doc(db, 'torneo_jugadores', jugadorId))
}
