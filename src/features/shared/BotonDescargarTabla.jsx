import { useState } from 'react'
import { toCanvas } from 'html-to-image'
import jsPDF from 'jspdf'

// Descarga una captura del elemento que apunta `targetRef` como imagen
// (PNG, para compartir por WhatsApp) o PDF. No hay backend en este
// proyecto, asi que la "foto" se genera enteramente en el navegador.
//
// Se usa html-to-image (no html2canvas): serializa el DOM a SVG y deja
// que el propio navegador lo dibuje en un <canvas>, asi que entiende
// cualquier color CSS moderno tal cual el navegador lo renderiza.
// html2canvas trae su propio parser de colores y no soporta oklab/
// oklch/color-mix - justo los que usa Tailwind v4 para los modificadores
// de opacidad (ej. "bg-danger-soft/40"), y tiraba
// "unsupported color function oklab".
export function BotonDescargarTabla({ targetRef, nombreArchivo = 'tabla' }) {
  const [generando, setGenerando] = useState(null) // 'imagen' | 'pdf' | null
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState(null)

  async function capturar() {
    const nodo = targetRef.current
    if (!nodo) {
      throw new Error('Todavía no hay nada para descargar.')
    }

    // Se clona el nodo FUERA de pantalla (para no mostrarle el cambio
    // al usuario) y se captura ese clon.
    const clon = nodo.cloneNode(true)
    clon.style.position = 'fixed'
    clon.style.top = '0'
    clon.style.left = '-99999px'

    // Si el contenido tiene un contenedor con scroll horizontal (tablas
    // viejas mas anchas que la pantalla), hay que sacarle el scroll y
    // agrandar todo a "max-content" para que entre completo. Las
    // tablas actuales (table-layout: fixed, sin scroll) NO tienen este
    // contenedor - ahi hay que dejar el clon con el mismo ancho que
    // tiene en pantalla, porque forzar "max-content" rompe el calculo
    // de columnas de table-fixed y termina rendereando todo en blanco.
    const scrollContainer = clon.querySelector('.overflow-x-auto')
    if (scrollContainer) {
      scrollContainer.style.overflow = 'visible'
      scrollContainer.style.width = 'max-content'
      clon.style.width = 'max-content'
    } else {
      clon.style.width = `${nodo.offsetWidth}px`
    }

    document.body.appendChild(clon)
    try {
      return await toCanvas(clon, { backgroundColor: '#ffffff', pixelRatio: 2 })
    } finally {
      document.body.removeChild(clon)
    }
  }

  async function handleDescargarImagen() {
    setAbierto(false)
    setError(null)
    setGenerando('imagen')
    try {
      const canvas = await capturar()
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${nombreArchivo}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[BotonDescargarTabla] imagen', err)
      setError(err.message || 'No se pudo generar la imagen.')
    } finally {
      setGenerando(null)
    }
  }

  async function handleDescargarPdf() {
    setAbierto(false)
    setError(null)
    setGenerando('pdf')
    try {
      const canvas = await capturar()
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      pdf.save(`${nombreArchivo}.pdf`)
    } catch (err) {
      console.error('[BotonDescargarTabla] pdf', err)
      setError(err.message || 'No se pudo generar el PDF.')
    } finally {
      setGenerando(null)
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setAbierto((v) => !v)}
        disabled={generando !== null}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink-soft disabled:opacity-50"
      >
        ⬇️ {generando ? 'Generando…' : 'Descargar'}
      </button>

      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface shadow-md">
          <button
            onClick={handleDescargarImagen}
            className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-paper"
          >
            🖼️ Imagen (foto)
          </button>
          <button
            onClick={handleDescargarPdf}
            className="block w-full px-3 py-2 text-left text-xs text-ink hover:bg-paper"
          >
            📄 PDF
          </button>
        </div>
      )}

      {error && (
        <p className="absolute right-0 mt-1 w-48 rounded-lg bg-danger-soft px-2 py-1.5 text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
