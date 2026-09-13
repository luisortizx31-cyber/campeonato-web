const CALIDAD_MINIMA = 0.35
const ANCHO_MINIMO_PX = 200

function codificarJpeg(canvas, calidad) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
}

function dibujarEnCanvas(bitmap, ancho, alto) {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto)
  return canvas
}

// Redimensiona/recomprime una imagen en el navegador antes de subirla a
// Storage - se usa en todo lado donde un visitante sube una foto (banners
// de publicidad, fotos de jugador, galeria de equipo) para que pese poco y
// cargue rapido incluso con mala señal, sin importar el formato de origen
// (png, webp, foto de celular, etc). Siempre devuelve un JPEG.
//
// pesoMaximoBytes (opcional): en vez de conformarse con una calidad fija,
// baja la calidad JPEG en pasos y, si con la calidad minima todavia pesa de
// mas, tambien achica el ancho - para que fotos de camara (varios MB) no se
// suban con su peso real solo porque ya entraban en el ancho maximo.
export async function comprimirImagen(file, {
  anchoMaximo = 1200,
  calidad = 0.82,
  tamanoMaximoOrigenBytes = 15 * 1024 * 1024,
  pesoMaximoBytes = null,
} = {}) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen.')
  }
  if (file.size > tamanoMaximoOrigenBytes) {
    throw new Error(`La imagen es demasiado pesada (maximo ${Math.round(tamanoMaximoOrigenBytes / (1024 * 1024))} MB).`)
  }

  const bitmap = await createImageBitmap(file)
  let ancho = Math.round(bitmap.width * Math.min(1, anchoMaximo / bitmap.width))
  let alto = Math.round(bitmap.height * (ancho / bitmap.width))

  let canvas = dibujarEnCanvas(bitmap, ancho, alto)
  let q = calidad
  let blob = await codificarJpeg(canvas, q)
  if (!blob) throw new Error('No se pudo procesar la imagen.')

  if (pesoMaximoBytes) {
    while (blob.size > pesoMaximoBytes && ancho > ANCHO_MINIMO_PX) {
      // Primero baja la calidad a este ancho...
      while (blob.size > pesoMaximoBytes && q > CALIDAD_MINIMA) {
        q = Math.max(CALIDAD_MINIMA, q - 0.1)
        blob = await codificarJpeg(canvas, q)
      }
      // ...y si con la calidad minima sigue pesando de mas, achica el ancho
      // y vuelve a probar calidades desde el valor original.
      if (blob.size > pesoMaximoBytes) {
        ancho = Math.round(ancho * 0.85)
        alto = Math.round(alto * 0.85)
        canvas = dibujarEnCanvas(bitmap, ancho, alto)
        q = calidad
        blob = await codificarJpeg(canvas, q)
      }
    }
  }

  bitmap.close()
  return blob
}
