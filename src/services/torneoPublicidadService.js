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
import { comprimirImagen } from '../utils/imagen'

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
