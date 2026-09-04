import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria, actualizarReclamo } from '../../../services/torneoPartidosService'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { colorEquipo } from '../../../utils/colorEquipo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'

// Fila de un reclamo dentro de una fecha - el texto se carga/edita
// desde el propio partido (Fechas -> Control de Partido -> Cancha),
// aca solo se ve y se puede quitar.
function FilaReclamo({ partido, nombreEquipo, onQuitar, quitando }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {nombreEquipo(partido.equipoLocalId)} vs {nombreEquipo(partido.equipoVisitanteId)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{partido.reclamo}</p>
          {partido.reclamoFecha?.toDate && (
            <p className="mt-1 text-xs text-ink-soft/70">
              Anotado el {partido.reclamoFecha.toDate().toLocaleDateString('es-PE')}
            </p>
          )}
        </div>
        <button
          onClick={onQuitar}
          disabled={quitando}
          className="shrink-0 rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
        >
          {quitando ? '…' : 'Quitar'}
        </button>
      </div>
    </li>
  )
}

// Vista de solo lectura (mas "Quitar") de los reclamos anotados por
// partido - el texto en si se carga desde ControlPartido (Cancha),
// aca se agrupan por fecha para poder revisarlos todos juntos.
export default function TabReclamos({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [expandidos, setExpandidos] = useState([])
  const [quitando, setQuitando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setPartidos(ps)
    } catch (err) {
      console.error('[TabReclamos]', err)
      setError('No se pudieron cargar los reclamos.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  function toggleExpandido(clave) {
    setExpandidos((e) => (e.includes(clave) ? e.filter((k) => k !== clave) : [...e, clave]))
  }

  const partidosConReclamo = partidos.filter((p) => p.reclamo)
  const fechasConReclamo = [...new Set(partidosConReclamo.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const reclamosSinFecha = partidosConReclamo.filter((p) => p.fechaNumero == null)

  async function handleQuitar(partido) {
    if (!confirm('¿Quitar este reclamo?')) return
    setQuitando(partido.id)
    setErrorAccion(null)
    try {
      await actualizarReclamo(partido.id, '')
      await cargar()
    } catch (err) {
      console.error('[TabReclamos]', err)
      setErrorAccion(err.message || 'No se pudo quitar el reclamo.')
    } finally {
      setQuitando(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex overflow-hidden rounded-xl border border-line">
        {Object.values(CATEGORIA_TORNEO).map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              categoria === c ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
            }`}
          >
            {CATEGORIA_TORNEO_LABELS[c]}
          </button>
        ))}
      </div>

      <div {...swipeCategoria}>
        {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {errorAccion && (
          <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
        )}

        {!cargando && !error && partidosConReclamo.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
            Todavía no hay reclamos anotados en esta categoría. Se cargan desde Fechas → 📋 Control → Cancha.
          </div>
        )}

        {!cargando && partidosConReclamo.length > 0 && (
          <ul className="space-y-2">
            {fechasConReclamo.map((f) => {
              const partidosFecha = partidosConReclamo.filter((p) => p.fechaNumero === f)
              const abierto = expandidos.includes(f)
              const color = colorEquipo(`Fecha ${f}`)
              return (
                <li key={f} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <button
                    onClick={() => toggleExpandido(f)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${color.bg}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
                        {f}
                      </span>
                      <span className={`truncate font-bold ${color.text}`}>Fecha {f}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                      {partidosFecha.length} reclamo{partidosFecha.length === 1 ? '' : 's'}
                      <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
                    </span>
                  </button>
                  {abierto && (
                    <ul className="divide-y divide-line border-t border-line bg-paper">
                      {partidosFecha.map((p) => (
                        <FilaReclamo
                          key={p.id}
                          partido={p}
                          nombreEquipo={nombreEquipo}
                          onQuitar={() => handleQuitar(p)}
                          quitando={quitando === p.id}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            {reclamosSinFecha.length > 0 && (
              <li className="overflow-hidden rounded-2xl border border-line bg-surface">
                <button
                  onClick={() => toggleExpandido('sin-fecha')}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                >
                  <span className="truncate font-bold text-ink-soft">Sin fecha asociada</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                    {reclamosSinFecha.length} reclamo{reclamosSinFecha.length === 1 ? '' : 's'}
                    <span className={`transition-transform ${expandidos.includes('sin-fecha') ? 'rotate-180' : ''}`}>⌄</span>
                  </span>
                </button>
                {expandidos.includes('sin-fecha') && (
                  <ul className="divide-y divide-line border-t border-line bg-paper">
                    {reclamosSinFecha.map((p) => (
                      <FilaReclamo
                        key={p.id}
                        partido={p}
                        nombreEquipo={nombreEquipo}
                        onQuitar={() => handleQuitar(p)}
                        quitando={quitando === p.id}
                      />
                    ))}
                  </ul>
                )}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
