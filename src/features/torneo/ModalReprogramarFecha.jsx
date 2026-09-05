import { useState } from 'react'
import { reprogramarFecha } from '../../services/torneoPartidosService'
import { timestampADatetimeLocal } from '../../utils/fixtureTorneo'

/**
 * Reprograma una Fecha completa (ej. se suspendio por lluvia). Corre
 * TODAS las fechas siguientes que ya tenian dia puesto la misma
 * cantidad de dias/horas - ver torneoPartidosService.reprogramarFecha,
 * que hace el calculo real. Los partidos ya jugados no se tocan.
 */
export default function ModalReprogramarFecha({ torneoId, categoria, fechaNumero, fechaReferencia, onCerrar, onGuardado }) {
  const [valor, setValor] = useState(() => timestampADatetimeLocal(fechaReferencia))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valor) {
      setError('Elegí la nueva fecha y hora.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await reprogramarFecha(torneoId, categoria, fechaNumero, new Date(valor))
      onGuardado()
    } catch (err) {
      console.error('[ModalReprogramarFecha]', err)
      setError(err.message || 'No se pudo reprogramar la fecha.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">Reprogramar Fecha {fechaNumero}</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-3">
            <label className="block text-sm font-medium text-ink mb-1">Nueva fecha y hora</label>
            <input
              type="datetime-local"
              required
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <p className="mb-4 text-xs text-ink-soft">
            Esto también corre todas las fechas siguientes que ya tengan día puesto, la misma
            cantidad de días — los partidos ya jugados no se tocan.
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Reprogramar'}
          </button>
        </form>
      </div>
    </div>
  )
}
