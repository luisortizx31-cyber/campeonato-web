import { useEffect, useState } from 'react'
import { registrarGol } from '../../services/torneoGolesService'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { calcularFechasConPartidoJugado } from '../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

/**
 * Gol "suelto": se carga desde la pestaña Goleadores, no esta atado a
 * un partido especifico - mismo criterio que ModalAgregarTarjeta.
 */
export default function ModalAgregarGol({ torneoId, categoria, equipos, partidos, onCerrar, onGuardado }) {
  const fechasJugadas = calcularFechasConPartidoJugado(partidos)

  const [form, setForm] = useState({
    equipoId: '',
    jugadorId: '',
    fechaJornada: fechasJugadas.length > 0 ? String(fechasJugadas[fechasJugadas.length - 1]) : '',
    cantidad: '1',
  })
  const [jugadores, setJugadores] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelado = false
    if (!form.equipoId) {
      setJugadores([])
      return
    }
    listarJugadoresPorEquipo(form.equipoId).then((js) => {
      if (!cancelado) setJugadores(js)
    })
    return () => {
      cancelado = true
    }
  }, [form.equipoId])

  function actualizar(campo, valor) {
    if (campo === 'equipoId') {
      setForm((f) => ({ ...f, equipoId: valor, jugadorId: '' }))
    } else {
      setForm((f) => ({ ...f, [campo]: valor }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.jugadorId) {
      setError('Elige un jugador.')
      return
    }
    if (!form.cantidad || Number(form.cantidad) <= 0) {
      setError('La cantidad de goles tiene que ser mayor a 0.')
      return
    }
    setEnviando(true)
    try {
      await registrarGol({
        torneoId,
        categoria,
        jugadorId: form.jugadorId,
        equipoId: form.equipoId,
        fechaNumero: form.fechaJornada,
        cantidad: form.cantidad,
      })
      onGuardado()
    } catch (err) {
      console.error('[ModalAgregarGol]', err)
      setError(err.message || 'No se pudo registrar el gol.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            Agregar gol · {CATEGORIA_TORNEO_LABELS[categoria]}
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

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Jugador</label>
            <select
              required
              disabled={!form.equipoId}
              value={form.jugadorId}
              onChange={(e) => actualizar('jugadorId', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            >
              <option value="">
                {form.equipoId ? 'Elegir…' : 'Primero elige un equipo'}
              </option>
              {jugadores.map((j) => (
                <option key={j.id} value={j.id}>{j.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Fecha</label>
              {fechasJugadas.length === 0 ? (
                <p className="rounded-lg bg-warning-soft px-2 py-2.5 text-xs text-warning">
                  Sin fechas jugadas.
                </p>
              ) : (
                <select
                  value={form.fechaJornada}
                  onChange={(e) => actualizar('fechaJornada', e.target.value)}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
                >
                  <option value="">Sin fecha</option>
                  {fechasJugadas.map((f) => (
                    <option key={f} value={f}>Fecha {f}</option>
                  ))}
                </select>
              )}
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
          <p className="mb-4 text-xs text-ink-soft">
            Si anotó más de un gol en la misma fecha, poné la cantidad total en vez de cargarlo varias veces.
          </p>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Agregar gol'}
          </button>
        </form>
      </div>
    </div>
  )
}
