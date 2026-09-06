import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

// Un solo equipo por id - lo usa TabMiEquipoDelegado (ver
// PaginaPublicaTorneo) para saber la categoria del equipo del
// delegado logueado, sin tener que traer toda la categoria.
export async function obtenerEquipo(equipoId) {
  const snap = await getDoc(doc(db, 'torneo_equipos', equipoId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function crearEquipo({ torneoId, categoria, nombre, delegadoNombre, delegadoTelefono, subdelegadoNombre, subdelegadoTelefono }) {
  const ref = await addDoc(collection(db, 'torneo_equipos'), {
    torneoId,
    categoria,
    nombre: nombre.trim(),
    delegadoNombre: delegadoNombre?.trim() || null,
    delegadoTelefono: delegadoTelefono?.trim() || null,
    subdelegadoNombre: subdelegadoNombre?.trim() || null,
    subdelegadoTelefono: subdelegadoTelefono?.trim() || null,
    creadoEn: serverTimestamp(),
  })
  return ref.id
}

export async function listarEquiposPorCategoria(torneoId, categoria) {
  const q = query(
    collection(db, 'torneo_equipos'),
    where('torneoId', '==', torneoId),
    where('categoria', '==', categoria)
  )
  const snap = await getDocs(q)
  const equipos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  equipos.sort((a, b) => a.nombre.localeCompare(b.nombre))
  return equipos
}

export async function actualizarEquipo(equipoId, { nombre, delegadoNombre, delegadoTelefono, subdelegadoNombre, subdelegadoTelefono }) {
  await updateDoc(doc(db, 'torneo_equipos', equipoId), {
    nombre: nombre.trim(),
    delegadoNombre: delegadoNombre?.trim() || null,
    delegadoTelefono: delegadoTelefono?.trim() || null,
    subdelegadoNombre: subdelegadoNombre?.trim() || null,
    subdelegadoTelefono: subdelegadoTelefono?.trim() || null,
  })
}

// Evita dejar jugadores/partidos huerfanos apuntando a un equipo que
// ya no existe (calcularTablaPosiciones los ignora, pero es mejor
// pedir que se limpien primero que perder datos en silencio). No
// necesita torneoId: equipoId ya es unico globalmente (id autogenerado
// por Firestore), y el permiso de borrado lo valida la regla de
// seguridad contra el torneoId guardado en el propio documento.
export async function eliminarEquipo(equipoId) {
  const jugadoresSnap = await getDocs(
    query(collection(db, 'torneo_jugadores'), where('equipoId', '==', equipoId))
  )
  if (!jugadoresSnap.empty) {
    throw new Error('Este equipo tiene jugadores registrados. Eliminalos primero.')
  }

  const [localSnap, visitanteSnap] = await Promise.all([
    getDocs(query(collection(db, 'torneo_partidos'), where('equipoLocalId', '==', equipoId))),
    getDocs(query(collection(db, 'torneo_partidos'), where('equipoVisitanteId', '==', equipoId))),
  ])
  if (!localSnap.empty || !visitanteSnap.empty) {
    throw new Error('Este equipo tiene partidos registrados. Eliminalos primero.')
  }

  await deleteDoc(doc(db, 'torneo_equipos', equipoId))
}
