import { useState } from 'react'
import { reprogramarFecha } from '../../services/torneoPartidosService'
import { SelectorFechaHora } from '../shared/SelectorFechaHora'

/**
 * Pone (o cambia) el dia/hora de TODA una Fecha de una sola vez - sirve
 * tanto para programarla por primera vez (todos sus partidos quedan
 * con el mismo dia/hora) como para reprogramarla si se suspendio (ej.
 * lluvia), en cuyo caso ademas corre TODAS las fechas siguientes que
 * ya tenian dia puesto la misma cantidad de dias/horas - ver
 * torneoPartidosService.reprogramarFecha, que hace el calculo real
 * segun si ya habia o no una fecha previa. Los partidos ya jugados
 * nunca se tocan. Un partido puntual se puede seguir reprogramando por
 * separado (icono 🗓 en su propia fila) sin afectar al resto.
 */
export default function ModalReprogramarFecha({ torneoId, categoria, fechaNumero, fechaReferencia, onCerrar, onGuardado }) {
  const [valor, setValor] = useState(fechaReferencia || null)
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
      await reprogramarFecha(torneoId, categoria, fechaNumero, valor)
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
          <h1 className="text-lg font-semibold text-ink">Programar Fecha {fechaNumero}</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-3">
            <label className="block text-sm font-medium text-ink mb-1">Nueva fecha y hora</label>
            <SelectorFechaHora value={valor} onChange={setValor} disabled={enviando} />
          </div>

          <p className="mb-1 text-xs text-ink-soft">
            Se aplica a todos los partidos de esta Fecha. Si después uno se posterga, lo cambiás
            aparte desde su propia fila (🗓), sin tocar el resto.
          </p>
          <p className="mb-4 text-xs text-ink-soft">
            Si esta Fecha ya tenía día puesto, cambiarlo acá también corre todas las fechas
            siguientes que ya tengan día, la misma cantidad de días — los partidos ya jugados no
            se tocan.
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>
  )
}
