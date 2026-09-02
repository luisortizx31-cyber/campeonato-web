import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { calcularLegPartido } from '../../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'

// Solo lectura: muestra los cruces y resultados por fecha del
// fixture. A diferencia de TabFechas (panel admin), no tiene ningun
// control para cargar/editar/generar nada - los jugadores y delegados
// solo pueden mirar.
export default function TabFechasPublica({ torneoId }) {
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    Promise.all([listarEquiposPorCategoria(torneoId, categoria), listarPartidosPorCategoria(torneoId, categoria)])
      .then(([eq, ps]) => {
        if (cancelado) return
        setEquipos(eq)
        setPartidos(ps)

        const fechas = [...new Set(ps.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
        setFechaSeleccionada((actual) => {
          if (fechas.length === 0) return null
          if (actual && fechas.includes(actual)) return actual
          return fechas[fechas.length - 1]
        })
      })
      .catch((err) => console.error('[TabFechasPublica]', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const partidosDeFecha = partidos.filter((p) => p.fechaNumero === fechaSeleccionada)

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaLeg(f) {
    const partidosF = partidos.filter((p) => p.fechaNumero === f)
    if (partidosF.length === 0) return null
    const legs = new Set(partidosF.map((p) => calcularLegPartido(p, partidos)))
    return legs.size === 1 ? [...legs][0] : 'mixta'
  }
  const fechasIda = fechasDisponibles.filter((f) => fechaLeg(f) === 'ida')
  const fechasVuelta = fechasDisponibles.filter((f) => fechaLeg(f) === 'vuelta')

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

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}

      {!cargando && fechasDisponibles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Todavía no hay fechas cargadas en esta categoría.
        </div>
      )}

      {!cargando && fechasDisponibles.length > 0 && (
        <>
          {fechasVuelta.length > 0 && (
            <p className="mb-2 text-xs text-ink-soft">
              <span className="font-semibold text-brand">Ida:</span> Fecha {Math.min(...fechasIda)}–{Math.max(...fechasIda)}
              {'  ·  '}
              <span className="font-semibold text-gold">Vuelta:</span> Fecha {Math.min(...fechasVuelta)}–{Math.max(...fechasVuelta)}
            </p>
          )}
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {fechasDisponibles.map((f) => {
              const esPrimeraVuelta = fechasVuelta.length > 0 && f === Math.min(...fechasVuelta)
              return (
                <div key={f} className="flex shrink-0 items-center gap-1.5">
                  {esPrimeraVuelta && <span className="h-6 w-px shrink-0 bg-line" />}
                  <button
                    onClick={() => setFechaSeleccionada(f)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      fechaSeleccionada === f
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-surface text-ink-soft'
                    }`}
                  >
                    Fecha {f}{fechaCompleta(f) ? ' ✓' : ''}
                  </button>
                </div>
              )
            })}
          </div>

          <ul className="space-y-2">
            {partidosDeFecha.map((p) => {
              const jugado = p.golesLocal != null && p.golesVisitante != null
              const leg = calcularLegPartido(p, partidos)
              return (
                <li key={p.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                  {leg && (
                    <p className="mb-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          leg === 'vuelta' ? 'bg-gold-soft text-gold' : 'bg-brand-soft text-brand'
                        }`}
                      >
                        {leg === 'vuelta' ? '↩ Vuelta' : 'Ida'}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{nombreEquipo(p.equipoLocalId)}</span>
                    {jugado ? (
                      <span className="money shrink-0 rounded-lg bg-paper px-3 py-1 text-sm font-semibold text-ink">
                        {p.golesLocal} — {p.golesVisitante}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-lg bg-paper px-3 py-1 text-xs text-ink-soft">Pendiente</span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-right text-sm text-ink">{nombreEquipo(p.equipoVisitanteId)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
