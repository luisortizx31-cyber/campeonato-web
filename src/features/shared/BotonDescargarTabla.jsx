import { useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// Descarga una captura del elemento que apunta `targetRef` como imagen
// (PNG, para compartir por WhatsApp) o PDF. No hay backend en este
// proyecto, asi que la "foto" se genera enteramente en el navegador
// con html2canvas en vez de renderizarse del lado del servidor.
export function BotonDescargarTabla({ targetRef, nombreArchivo = 'tabla' }) {
  const [generando, setGenerando] = useState(null) // 'imagen' | 'pdf' | null
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState(null)

  async function capturar() {
    if (!targetRef.current) {
      throw new Error('Todavía no hay nada para descargar.')
    }
    return html2canvas(targetRef.current, { backgroundColor: '#ffffff', scale: 2 })
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
