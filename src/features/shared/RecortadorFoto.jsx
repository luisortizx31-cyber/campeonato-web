import { useEffect, useRef, useState } from 'react'

const ZOOM_MAXIMO = 4
// Lado (px) del cuadrado que se guarda. Mas que los 500 px a los que
// despues lo achica comprimirImagen (ver torneoJugadoresService), para
// que ese ultimo paso no tenga que agrandar nada.
const LADO_SALIDA_PX = 600

function limitar(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor))
}

function distancia(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Editor de la foto ya cargada. El cuadro es el recorte que se guarda
// (siempre cuadrado, como los avatares); el circulo punteado muestra como
// se va a ver en la lista de jugadores.
//
// Geometria: con zoom 1 la foto "cubre" el cuadro (su lado mas corto
// llena el cuadro); con el zoom minimo se ve la foto ENTERA (quedan
// bordes vacios si no es cuadrada). `x`/`y` son el desplazamiento del
// centro de la foto respecto al centro del cuadro, en px de pantalla.
function EditorRecorte({ imagen, onConfirmar, onCancelar }) {
  const [rotacion, setRotacion] = useState(0)
  const [vista, setVista] = useState({ zoom: 1, x: 0, y: 0 })
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)
  const [tam] = useState(() => Math.min(320, window.innerWidth - 40))
  const punteros = useRef(new Map())
  const gesto = useRef(null)

  const girada = rotacion % 180 !== 0
  const ancho = girada ? imagen.naturalHeight : imagen.naturalWidth
  const alto = girada ? imagen.naturalWidth : imagen.naturalHeight
  const escalaBase = tam / Math.min(ancho, alto)
  const zoomMinimo = Math.min(ancho, alto) / Math.max(ancho, alto)
  const escala = escalaBase * vista.zoom

  // Deja el zoom dentro de [zoomMinimo, ZOOM_MAXIMO] y el desplazamiento
  // dentro de lo que impide que se vea un borde vacio (si la foto es mas
  // chica que el cuadro en un eje, queda centrada en ese eje).
  function ajustar(zoom, x, y) {
    const z = limitar(zoom, zoomMinimo, ZOOM_MAXIMO)
    const maxX = Math.max(0, (ancho * escalaBase * z - tam) / 2)
    const maxY = Math.max(0, (alto * escalaBase * z - tam) / 2)
    return { zoom: z, x: limitar(x, -maxX, maxX), y: limitar(y, -maxY, maxY) }
  }

  function cambiarZoom(zoom) {
    setVista((v) => ajustar(zoom, v.x, v.y))
  }

  function girar() {
    setRotacion((r) => (r + 90) % 360)
    setVista({ zoom: 1, x: 0, y: 0 })
  }

  // Un dedo (o el mouse) mueve la foto; dos dedos hacen zoom (pellizco).
  function reiniciarGesto() {
    const puntos = [...punteros.current.values()]
    if (puntos.length === 1) {
      gesto.current = { tipo: 'mover', inicio: puntos[0], vista }
    } else if (puntos.length >= 2) {
      gesto.current = { tipo: 'zoom', distancia: distancia(puntos[0], puntos[1]) || 1, vista }
    } else {
      gesto.current = null
    }
  }

  function handlePointerDown(e) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Sin captura igual funciona mientras el dedo siga dentro del cuadro.
    }
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    reiniciarGesto()
  }

  function handlePointerMove(e) {
    if (!punteros.current.has(e.pointerId)) return
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesto.current
    if (!g) return
    if (g.tipo === 'mover') {
      setVista(ajustar(g.vista.zoom, g.vista.x + (e.clientX - g.inicio.x), g.vista.y + (e.clientY - g.inicio.y)))
    } else {
      const [a, b] = [...punteros.current.values()]
      setVista(ajustar(g.vista.zoom * (distancia(a, b) / g.distancia), g.vista.x, g.vista.y))
    }
  }

  function handlePointerUp(e) {
    punteros.current.delete(e.pointerId)
    reiniciarGesto()
  }

  function handleWheel(e) {
    cambiarZoom(vista.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }

  function confirmar() {
    setProcesando(true)
    setError(null)
    const canvas = document.createElement('canvas')
    canvas.width = LADO_SALIDA_PX
    canvas.height = LADO_SALIDA_PX
    const ctx = canvas.getContext('2d')
    // Fondo liso por si se dejo la foto entera con bordes vacios (el JPEG
    // no tiene transparencia).
    ctx.fillStyle = '#f7f5f0'
    ctx.fillRect(0, 0, LADO_SALIDA_PX, LADO_SALIDA_PX)
    ctx.imageSmoothingQuality = 'high'
    const f = LADO_SALIDA_PX / tam
    ctx.translate(LADO_SALIDA_PX / 2 + vista.x * f, LADO_SALIDA_PX / 2 + vista.y * f)
    ctx.rotate((rotacion * Math.PI) / 180)
    ctx.scale(escala * f, escala * f)
    ctx.drawImage(imagen, -imagen.naturalWidth / 2, -imagen.naturalHeight / 2)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('No se pudo recortar la foto. Probá con otra.')
          setProcesando(false)
          return
        }
        onConfirmar(new File([blob], 'foto.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92
    )
  }

  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl">
      <h2 className="mb-1 text-base font-semibold text-ink">Recortar foto</h2>
      <p className="mb-3 text-xs text-ink-soft">
        Arrastrá la foto para moverla y usá la barra (o pellizcá) para acercarla. El círculo es como se va a ver en la lista.
      </p>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative mx-auto touch-none select-none overflow-hidden rounded-xl bg-paper"
        style={{ width: tam, height: tam }}
      >
        <img
          src={imagen.src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            left: tam / 2 + vista.x,
            top: tam / 2 + vista.y,
            width: imagen.naturalWidth * escala,
            height: imagen.naturalHeight * escala,
            transform: `translate(-50%, -50%) rotate(${rotacion}deg)`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-ink-soft">Zoom</span>
        <input
          type="range"
          min={zoomMinimo}
          max={ZOOM_MAXIMO}
          step="any"
          value={vista.zoom}
          disabled={procesando}
          onChange={(e) => cambiarZoom(Number(e.target.value))}
          className="min-w-0 flex-1 accent-brand"
          aria-label="Zoom"
        />
        <button
          type="button"
          onClick={girar}
          disabled={procesando}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft disabled:opacity-50"
        >
          ↻ Girar
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancelar}
          disabled={procesando}
          className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={procesando}
          className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {procesando ? 'Procesando…' : 'Usar esta foto'}
        </button>
      </div>
    </div>
  )
}

/**
 * Antes de subir una foto de jugador o de equipo (ver AvatarFoto), la
 * deja recortar: mover, acercar (o alejar hasta ver la foto entera) y
 * girar. `archivo` es el File que eligio la persona; `onConfirmar`
 * recibe un File nuevo (JPEG cuadrado) ya recortado, que sigue el mismo
 * camino de siempre (comprimirImagen + subida a Storage); `onCancelar`
 * cierra sin subir nada.
 */
export function RecortadorFoto({ archivo, onConfirmar, onCancelar }) {
  const [imagen, setImagen] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    let cancelado = false
    img.onload = () => {
      if (!cancelado) setImagen(img)
    }
    img.onerror = () => {
      if (!cancelado) setError('No se pudo abrir esta imagen. Probá con otra (JPG o PNG).')
    }
    img.src = url
    return () => {
      cancelado = true
      URL.revokeObjectURL(url)
    }
  }, [archivo])

  // Mientras esta abierto, la pagina de atras no debe scrollear (la
  // rueda del mouse se usa para el zoom).
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  // Un click dentro no debe llegar a la fila/tarjeta donde vive el
  // avatar (el click de React burbujea por el arbol de componentes
  // aunque el modal sea position:fixed).
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-5"
    >
      {error ? (
        <div className="w-full max-w-sm rounded-2xl bg-surface p-4 text-center shadow-xl">
          <p className="mb-3 text-sm text-danger">{error}</p>
          <button onClick={onCancelar} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft">
            Cerrar
          </button>
        </div>
      ) : imagen ? (
        <EditorRecorte imagen={imagen} onConfirmar={onConfirmar} onCancelar={onCancelar} />
      ) : (
        <p className="text-sm text-white">Abriendo foto…</p>
      )}
    </div>
  )
}
