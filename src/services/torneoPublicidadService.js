import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../config/firebase'

const ANCHO_MAXIMO_PX = 1200
const CALIDAD_JPEG = 0.82
const TAMANO_MAXIMO_ORIGEN_BYTES = 15 * 1024 * 1024

// Banners de publicidad del link publico (ver PublicidadBanner.jsx) -
// el Maestro sube una imagen y, opcionalmente, un link a donde manda
// el clic (WhatsApp del sponsor, su Instagram, su pagina, etc). Se
// pueden tener varios a la vez: el banner publico rota entre los que
// esten `activa:true`, en el orden que el Maestro defina (`orden`).
//
// { torneoId, imagenUrl, enlaceUrl, activa, orden, impresiones, clics, creadoEn }

function rutaImagen(torneoId, anuncioId) {
  return `torneo/${torneoId}/publicidad/${anuncioId}.jpg`
}

// Redimensiona/recomprime la imagen en el navegador antes de subirla -
// no hay backend en este proyecto, y un banner que ve TODO el publico
// del link (no solo el Maestro) conviene que pese poco para que cargue
// rapido incluso con mala señal. Siempre se sube como JPEG, sin
// importar el formato original (png, webp, foto de celular, etc).
async function comprimirImagen(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen.')
  }
  if (file.size > TAMANO_MAXIMO_ORIGEN_BYTES) {
    throw new Error('La imagen es demasiado pesada (maximo 15 MB).')
  }
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, ANCHO_MAXIMO_PX / bitmap.width)
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG))
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  return blob
}

export async function listarPublicidad(torneoId) {
  const snap = await getDocs(query(collection(db, 'torneo_publicidad'), where('torneoId', '==', torneoId)))
  const anuncios = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  anuncios.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  return anuncios
}

// Crea el doc y sube la imagen en dos pasos porque la ruta del
// Storage usa el id del doc (necesita existir primero) - mientras
// tanto queda `imagenUrl: null` (la UI lo trata como "subiendo...").
export async function crearPublicidad({ torneoId, archivo, enlaceUrl, orden }) {
  const blob = await comprimirImagen(archivo)

  const ref_ = await addDoc(collection(db, 'torneo_publicidad'), {
    torneoId,
    imagenUrl: null,
    enlaceUrl: enlaceUrl?.trim() || null,
    activa: true,
    orden: orden ?? Date.now(),
    impresiones: 0,
    clics: 0,
    creadoEn: serverTimestamp(),
  })

  const fileRef = ref(storage, rutaImagen(torneoId, ref_.id))
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  const imagenUrl = await getDownloadURL(fileRef)
  await updateDoc(ref_, { imagenUrl })
  return ref_.id
}

export async function actualizarImagenPublicidad(torneoId, anuncioId, archivo) {
  const blob = await comprimirImagen(archivo)
  const fileRef = ref(storage, rutaImagen(torneoId, anuncioId))
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' })
  const imagenUrl = await getDownloadURL(fileRef)
  await updateDoc(doc(db, 'torneo_publicidad', anuncioId), { imagenUrl })
}

export async function actualizarEnlacePublicidad(anuncioId, enlaceUrl) {
  await updateDoc(doc(db, 'torneo_publicidad', anuncioId), { enlaceUrl: enlaceUrl?.trim() || null })
}

export async function alternarActivaPublicidad(anuncioId, activa) {
  await updateDoc(doc(db, 'torneo_publicidad', anuncioId), { activa })
}

// `anuncios` ya viene en el orden final deseado (ver TabPublicidad,
// mover con ▲▼) - se guarda el indice de cada uno como `orden`.
export async function reordenarPublicidad(anuncios) {
  const batch = writeBatch(db)
  anuncios.forEach((a, i) => batch.update(doc(db, 'torneo_publicidad', a.id), { orden: i }))
  await batch.commit()
}

export async function eliminarPublicidad(torneoId, anuncioId) {
  await deleteDoc(doc(db, 'torneo_publicidad', anuncioId))
  try {
    await deleteObject(ref(storage, rutaImagen(torneoId, anuncioId)))
  } catch (err) {
    // Si la imagen ya no existe (o nunca termino de subirse porque se
    // borro el anuncio a medio subir), no bloquea el borrado del doc.
    console.error('[torneoPublicidadService] eliminarPublicidad deleteObject', err)
  }
}

// Las dos de aca abajo las llama cualquier visitante de la pagina
// publica, sin login (ver PublicidadBanner.jsx) - la regla de
// Firestore solo les permite subir estos dos contadores de a uno,
// nunca tocar otro campo del anuncio.
export async function registrarImpresionPublicidad(anuncioId) {
  await updateDoc(doc(db, 'torneo_publicidad', anuncioId), { impresiones: increment(1) })
}

export async function registrarClicPublicidad(anuncioId) {
  await updateDoc(doc(db, 'torneo_publicidad', anuncioId), { clics: increment(1) })
}
