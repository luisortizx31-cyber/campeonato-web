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
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { comprimirImagen } from '../utils/imagen'

function rutaFotoPortadaEquipo(torneoId, equipoId) {
  return `torneo/${torneoId}/equipos/${equipoId}/portada.jpg`
}

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

// Texto libre con la historia de la promocion/equipo (ver DetalleEquipo,
// pestaña Historia) - separado de actualizarEquipo porque se edita desde
// una pantalla distinta al modal de editar equipo.
export async function actualizarHistoriaEquipo(equipoId, historia) {
  await updateDoc(doc(db, 'torneo_equipos', equipoId), {
    historia: historia?.trim() || null,
  })
}

// Foto de portada del equipo/promocion (ver TabEquipos) - se muestra en
// vez del escudo con la inicial en Jugadores y en la ficha de la
// promocion (ver EscudoEquipo, DetalleEquipo/DetalleEquipoPublica). Se
// sube siempre a la misma ruta, asi que cambiarla sobreescribe la
// anterior sin dejar basura en Storage.
export async function actualizarFotoPortadaEquipo(torneoId, equipoId, archivo) {
  const blob = await comprimirImagen(archivo, { pesoMaximoBytes: 50 * 1024 })
  const fileRef = ref(storage, rutaFotoPortadaEquipo(torneoId, equipoId))
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  const fotoPortadaUrl = await getDownloadURL(fileRef)
  await updateDoc(doc(db, 'torneo_equipos', equipoId), { fotoPortadaUrl })
}

export async function eliminarFotoPortadaEquipo(torneoId, equipoId) {
  await updateDoc(doc(db, 'torneo_equipos', equipoId), { fotoPortadaUrl: null })
  try {
    await deleteObject(ref(storage, rutaFotoPortadaEquipo(torneoId, equipoId)))
  } catch (err) {
    console.error('[torneoEquiposService] eliminarFotoPortadaEquipo deleteObject', err)
  }
}

// Evita dejar jugadores/partidos huerfanos apuntando a un equipo que
// ya no existe (calcularTablaPosiciones los ignora, pero es mejor
// pedir que se limpien primero que perder datos en silencio). No
// necesita torneoId: equipoId ya es unico globalmente (id autogenerado
// por Firestore), y el permiso de borrado lo valida la regla de
// seguridad contra el torneoId guardado en el propio documento.
export async function eliminarEquipo(equipoId, torneoId) {
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
  try {
    await deleteObject(ref(storage, rutaFotoPortadaEquipo(torneoId, equipoId)))
  } catch (err) {
    // El equipo puede no tener foto de portada nunca subida - no bloquea el borrado.
    console.error('[torneoEquiposService] eliminarEquipo deleteObject foto', err)
  }
}
