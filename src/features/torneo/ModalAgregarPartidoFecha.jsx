import { useState } from 'react'
import { agregarPartidoManual } from '../../services/torneoPartidosService'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

/**
 * Agrega un partido a mano a una fecha (existente o nueva). Pensado
 * para cuando el campeonato ya arranco con un sorteo hecho por fuera
 * de la app: el Maestro va cargando los cruces reales fecha a fecha
 * en vez de usar el "todos contra todos" automatico (ver TabFechas).
 * El resultado es opcional - si no se llena, el partido queda
 * pendiente para cargarlo despues desde la misma pestaña.
 */
export default function ModalAgregarPartidoFecha({ torneoId, categoria, equipos, partidos, fechaSugerida, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    fechaNumero: String(fechaSugerida || 1),
    equipoLocalId: '',
    equipoVisitanteId: '',
    golesLocal: '',
    golesVisitante: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  // Equipos que ya tienen un partido en la fecha elegida - no pueden
  // volver a jugar otro ese mismo dia, asi que se deshabilitan en los
  // dos selectores. Se recalcula cada vez que cambia la fecha elegida.
  const fechaNum = Number(form.fechaNumero)
  const equiposOcupados = new Set(
    partidos
      .filter((p) => p.fechaNumero === fechaNum)
      .flatMap((p) => [p.equipoLocalId, p.equipoVisitanteId])
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.equipoLocalId || !form.equipoVisitanteId) {
      setError('Elige los dos equipos.')
      return
    }
    if (form.equipoLocalId === form.equipoVisitanteId) {
      setError('El equipo local y el visitante no pueden ser el mismo.')
      return
    }
    const hayAlgunGol = form.golesLocal !== '' || form.golesVisitante !== ''
    const hayLosDosGoles = form.golesLocal !== '' && form.golesVisitante !== ''
    if (hayAlgunGol && !hayLosDosGoles) {
      setError('Completa el marcador de los dos equipos, o deja los dos vacíos si todavía no se jugó.')
      return
    }

    setEnviando(true)
    try {
      await agregarPartidoManual({
        torneoId,
        categoria,
        fechaNumero: form.fechaNumero,
        equipoLocalId: form.equipoLocalId,
        equipoVisitanteId: form.equipoVisitanteId,
        golesLocal: form.golesLocal,
        golesVisitante: form.golesVisitante,
      })
      onGuardado(Number(form.fechaNumero))
    } catch (err) {
      console.error('[ModalAgregarPartidoFecha]', err)
      setError(err.message || 'No se pudo agregar el partido.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            Agregar partido · {CATEGORIA_TORNEO_LABELS[categoria]}
          </h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Fecha</label>
            <input
              type="number"
              min="1"
              required
              inputMode="numeric"
              value={form.fechaNumero}
              onChange={(e) => actualizar('fechaNumero', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Podés usar una fecha que ya existe (para agregarle otro partido) o un número nuevo.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Local</label>
              <select
                required
                value={form.equipoLocalId}
                onChange={(e) => actualizar('equipoLocalId', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              >
                <option value="">Elegir…</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id} disabled={equiposOcupados.has(eq.id)}>
                    {eq.nombre}{equiposOcupados.has(eq.id) ? ' (ya juega esta fecha)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Visitante</label>
              <select
                required
                value={form.equipoVisitanteId}
                onChange={(e) => actualizar('equipoVisitanteId', e.target.value)}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              >
                <option value="">Elegir…</option>
                {equipos.map((eq) => (
                  <option key={eq.id} value={eq.id} disabled={equiposOcupados.has(eq.id)}>
                    {eq.nombre}{equiposOcupados.has(eq.id) ? ' (ya juega esta fecha)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {equiposOcupados.size > 0 && (
            <p className="mb-4 -mt-2 text-xs text-ink-soft">
              Los equipos marcados "(ya juega esta fecha)" no se pueden elegir porque ya tienen un
              partido en la Fecha {form.fechaNumero || '—'}.
            </p>
          )}

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">Resultado (opcional)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.golesLocal}
                onChange={(e) => actualizar('golesLocal', e.target.value)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-2 text-center text-ink outline-none focus-visible:border-brand"
              />
              <span className="text-ink-soft">—</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.golesVisitante}
                onChange={(e) => actualizar('golesVisitante', e.target.value)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-2 text-center text-ink outline-none focus-visible:border-brand"
              />
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Si ya se jugó, poné el marcador. Si todavía no, dejalo en blanco y lo cargás después
              desde esta misma pestaña.
            </p>
          </div>

          {error && (
            <p className="mt-3 mb-1 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-3 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Agregar partido'}
          </button>
        </form>
      </div>
    </div>
  )
}
