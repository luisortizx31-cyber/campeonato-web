// Redimensiona/recomprime una imagen en el navegador antes de subirla a
// Storage - se usa en todo lado donde un visitante sube una foto (banners
// de publicidad, fotos de jugador, galeria de equipo) para que pese poco y
// cargue rapido incluso con mala señal, sin importar el formato de origen
// (png, webp, foto de celular, etc). Siempre devuelve un JPEG.
export async function comprimirImagen(file, { anchoMaximo = 1200, calidad = 0.82, tamanoMaximoOrigenBytes = 15 * 1024 * 1024 } = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen.')
  }
  if (file.size > tamanoMaximoOrigenBytes) {
    throw new Error(`La imagen es demasiado pesada (maximo ${Math.round(tamanoMaximoOrigenBytes / (1024 * 1024))} MB).`)
  }
  const bitmap = await createImageBitmap(file)
  const escala = Math.min(1, anchoMaximo / bitmap.width)
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  return blob
}
