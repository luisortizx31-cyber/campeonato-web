import { useState } from 'react'
import { agregarAjustePuntos } from '../../services/torneoAjustesService'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

/**
 * Bonificacion o sancion de puntos aplicada a mano a un equipo (ej.
 * desfile, fair play, conducta antideportiva) - separada de los
 * puntos que salen de los resultados de partidos. Queda registrada
 * con motivo para que se pueda auditar despues (ver "Ajustes
 * aplicados" en TabPosiciones).
 */
export default function ModalAjustarPuntos({ torneoId, categoria, equipos, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    equipoId: '',
    tipo: 'sumar',
    cantidad: '',
    motivo: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.equipoId) {
      setError('Elige un equipo.')
      return
    }
    if (!form.cantidad || Number(form.cantidad) <= 0) {
      setError('La cantidad de puntos tiene que ser mayor a 0.')
      return
    }
    setEnviando(true)
    try {
      const puntos = form.tipo === 'restar' ? -Number(form.cantidad) : Number(form.cantidad)
      await agregarAjustePuntos({ torneoId, categoria, equipoId: form.equipoId, puntos, motivo: form.motivo })
      onGuardado()
    } catch (err) {
      console.error('[ModalAjustarPuntos]', err)
      setError(err.message || 'No se pudo aplicar el ajuste.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            Ajustar puntos · {CATEGORIA_TORNEO_LABELS[categoria]}
          </h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Equipo</label>
            <select
              required
              value={form.equipoId}
              onChange={(e) => actualizar('equipoId', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              <option value="">Elegir…</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => actualizar('tipo', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              >
                <option value="sumar">Sumar puntos</option>
                <option value="restar">Restar puntos</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                required
                inputMode="numeric"
                value={form.cantidad}
                onChange={(e) => actualizar('cantidad', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              />
            </div>
          </div>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={form.motivo}
              onChange={(e) => actualizar('motivo', e.target.value)}
              placeholder="Ej: bonificación por desfile"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            Queda guardado con fecha y motivo, y se puede deshacer después desde "Ajustes aplicados".
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Aplicar ajuste'}
          </button>
        </form>
      </div>
    </div>
  )
}
