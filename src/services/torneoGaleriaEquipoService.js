import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'
import { comprimirImagen } from '../utils/imagen'

// Galeria de fotos de recuerdo de una promocion/equipo (ver DetalleEquipo,
// pestaña Galeria de fotos) - hasta MAXIMO_FOTOS por promocion, cada una con
// una descripcion opcional. Coleccion flat con equipoId/torneoId
// denormalizados, mismo estilo que torneo_publicidad/torneo_tarjetas (no
// subcoleccion).
//
// { torneoId, equipoId, url, descripcion, orden, creadoEn }

export const MAXIMO_FOTOS_GALERIA = 5

function rutaImagen(torneoId, equipoId, fotoId) {
  return `torneo/${torneoId}/equipos/${equipoId}/galeria/${fotoId}.jpg`
}

export async function listarFotosEquipo(equipoId) {
  const snap = await getDocs(query(collection(db, 'torneo_equipo_fotos'), where('equipoId', '==', equipoId)))
  const fotos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  fotos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  return fotos
}

// Mismo patron en dos pasos que torneoPublicidadService.crearPublicidad: el
// doc se crea primero (con url:null) porque la ruta de Storage necesita su
// id, y recien despues se sube la imagen y se guarda la url final.
export async function agregarFotoEquipo({ torneoId, equipoId, archivo, descripcion }) {
  const existentes = await listarFotosEquipo(equipoId)
  if (existentes.length >= MAXIMO_FOTOS_GALERIA) {
    throw new Error(`Esta promoción ya tiene el máximo de ${MAXIMO_FOTOS_GALERIA} fotos en su galería.`)
  }

  const blob = await comprimirImagen(archivo, { pesoMaximoBytes: 50 * 1024 })

  const ref_ = await addDoc(collection(db, 'torneo_equipo_fotos'), {
    torneoId,
    equipoId,
    url: null,
    descripcion: descripcion?.trim() || null,
    orden: existentes.length,
    creadoEn: serverTimestamp(),
  })

  const fileRef = ref(storage, rutaImagen(torneoId, equipoId, ref_.id))
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  const url = await getDownloadURL(fileRef)
  await updateDoc(ref_, { url })
  return ref_.id
}

export async function actualizarDescripcionFotoEquipo(fotoId, descripcion) {
  await updateDoc(doc(db, 'torneo_equipo_fotos', fotoId), { descripcion: descripcion?.trim() || null })
}

export async function eliminarFotoEquipo(torneoId, equipoId, fotoId) {
  await deleteDoc(doc(db, 'torneo_equipo_fotos', fotoId))
  try {
    await deleteObject(ref(storage, rutaImagen(torneoId, equipoId, fotoId)))
  } catch (err) {
    console.error('[torneoGaleriaEquipoService] eliminarFotoEquipo deleteObject', err)
  }
}
