import { useEffect, useRef, useState } from 'react'
import { obtenerConfigTorneo, subirBases } from '../../../services/torneoConfigService'

export default function TabBases({ torneoId }) {
  const [config, setConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  async function cargar() {
    setCargando(true)
    try {
      setConfig(await obtenerConfigTorneo(torneoId))
    } catch (err) {
      console.error('[TabBases]', err)
      setError('No se pudo cargar la información de las bases.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [torneoId])

  async function handleArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSubiendo(true)
    try {
      await subirBases(torneoId, file)
      await cargar()
    } catch (err) {
      console.error('[TabBases]', err)
      setError(err.message || 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-ink">Bases del campeonato</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Sube el documento (PDF) con las bases y reglamento del torneo. Se muestra en el link
          público para que jugadores y delegados lo puedan consultar.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
        {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}

        {!cargando && config?.basesUrl ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                📄 {config.basesNombreArchivo || 'bases.pdf'}
              </p>
              {config.basesSubidoEn?.toDate && (
                <p className="text-xs text-ink-soft">
                  Subido el {config.basesSubidoEn.toDate().toLocaleDateString('es-PE')}
                </p>
              )}
            </div>
            <a
              href={config.basesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft"
            >
              Ver PDF
            </a>
          </div>
        ) : (
          !cargando && (
            <p className="text-sm text-ink-soft">Todavía no subiste las bases del torneo.</p>
          )
        )}

        {error && (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            {config?.basesUrl ? 'Subir un PDF nuevo (reemplaza el actual)' : 'Subir PDF'}
          </label>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleArchivo}
            disabled={subiendo}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
          {subiendo && <p className="mt-2 text-xs text-ink-soft">Subiendo…</p>}
        </div>
      </div>
    </div>
  )
}
