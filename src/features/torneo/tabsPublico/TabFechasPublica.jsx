import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { calcularLegPartido } from '../../../utils/fixtureTorneo'
import { CATEGORIA_TORNEO, CATEGORIA_TORNEO_LABELS } from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { colorEquipo, inicialEquipo } from '../../../utils/colorEquipo'

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

  const barraFechasRef = useRef(null)
  useEffect(() => {
    if (!barraFechasRef.current || fechaSeleccionada == null) return
    const activo = barraFechasRef.current.querySelector(`[data-fecha="${fechaSeleccionada}"]`)
    activo?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [fechaSeleccionada])

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
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  const partidosDeFecha = partidos.filter((p) => p.fechaNumero === fechaSeleccionada)

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos.filter((p) => p.fechaNumero === f).some((p) => p.golesLocal != null)
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
          <div ref={barraFechasRef} className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {fechasDisponibles.map((f) => {
              const completa = fechaCompleta(f)
              const empezada = !completa && fechaEmpezada(f)
              const esPrimeraVuelta = fechasVuelta.length > 0 && f === Math.min(...fechasVuelta)
              return (
                <div key={f} className="flex shrink-0 items-center gap-1.5">
                  {esPrimeraVuelta && <span className="h-6 w-px shrink-0 bg-line" />}
                  <button
                    data-fecha={f}
                    onClick={() => setFechaSeleccionada(f)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      fechaSeleccionada === f
                        ? 'border-brand bg-brand text-white'
                        : completa
                          ? 'border-danger/30 bg-danger-soft text-danger'
                          : empezada
                            ? 'border-warning/30 bg-warning-soft text-warning'
                            : 'border-line bg-surface text-ink-soft'
                    }`}
                  >
                    Fecha {f}{completa ? ' ✓' : ''}
                  </button>
                </div>
              )
            })}
          </div>

          <ul className="space-y-2.5" {...swipeFecha}>
            {partidosDeFecha.map((p) => {
              const jugado = p.golesLocal != null && p.golesVisitante != null
              const leg = calcularLegPartido(p, partidos)
              const ganoLocal = jugado && p.golesLocal > p.golesVisitante
              const ganoVisitante = jugado && p.golesVisitante > p.golesLocal
              const nombreLocal = nombreEquipo(p.equipoLocalId)
              const nombreVisitante = nombreEquipo(p.equipoVisitanteId)
              const colorLocal = colorEquipo(nombreLocal)
              const colorVisitante = colorEquipo(nombreVisitante)
              return (
                <li
                  key={p.id}
                  className={`overflow-hidden rounded-2xl border border-l-4 bg-surface shadow-sm ${
                    jugado ? 'border-line border-l-success' : 'border-dashed border-line border-l-line'
                  }`}
                >
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    {jugado ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Jugado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
                        <span className="h-1.5 w-1.5 rounded-full bg-line" /> Pendiente
                      </span>
                    )}
                    {leg === 'ida' && (
                      <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Ida</span>
                    )}
                    {leg === 'vuelta' && (
                      <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">↩ Vuelta</span>
                    )}
                  </div>

                  <div className="space-y-1.5 px-4 pb-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorLocal.bg} ${colorLocal.text}`}
                      >
                        {inicialEquipo(nombreLocal)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          ganoLocal ? 'font-bold text-ink' : ganoVisitante ? 'font-medium text-ink-soft' : 'font-medium text-ink'
                        }`}
                      >
                        {nombreLocal}
                      </span>
                      <span
                        className={`money w-10 shrink-0 rounded-lg py-1.5 text-center text-base font-bold text-ink ${
                          jugado ? 'bg-success-soft' : 'bg-paper text-ink-soft'
                        }`}
                      >
                        {jugado ? p.golesLocal : '–'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorVisitante.bg} ${colorVisitante.text}`}
                      >
                        {inicialEquipo(nombreVisitante)}
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          ganoVisitante ? 'font-bold text-ink' : ganoLocal ? 'font-medium text-ink-soft' : 'font-medium text-ink'
                        }`}
                      >
                        {nombreVisitante}
                      </span>
                      <span
                        className={`money w-10 shrink-0 rounded-lg py-1.5 text-center text-base font-bold text-ink ${
                          jugado ? 'bg-success-soft' : 'bg-paper text-ink-soft'
                        }`}
                      >
                        {jugado ? p.golesVisitante : '–'}
                      </span>
                    </div>
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
