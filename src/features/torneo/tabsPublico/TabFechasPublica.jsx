import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { suscribirPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { calcularLegPartido, formatearFechaProgramada } from '../../../utils/fixtureTorneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { colorEquipo, inicialEquipo } from '../../../utils/colorEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'

// Solo lectura: muestra los cruces y resultados por fecha del
// fixture. A diferencia de TabFechas (panel admin), no tiene ningun
// control para cargar/editar/generar nada - los jugadores y delegados
// solo pueden mirar.
export default function TabFechasPublica({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
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

  // Los partidos se siguen en vivo (onSnapshot) en vez de traerse una
  // sola vez - asi el marcador en vivo que carga ControlPartido (ver
  // torneoPartidosService.actualizarMarcadorEnVivo) se actualiza solo
  // en esta pantalla, sin que quien esta mirando tenga que refrescar.
  useEffect(() => {
    let cancelado = false
    let equiposListos = false
    let partidosListos = false
    setCargando(true)

    function intentarTerminarCarga() {
      if (equiposListos && partidosListos && !cancelado) setCargando(false)
    }

    listarEquiposPorCategoria(torneoId, categoria)
      .then((eq) => {
        if (!cancelado) setEquipos(eq)
      })
      .catch((err) => console.error('[TabFechasPublica]', err))
      .finally(() => {
        equiposListos = true
        intentarTerminarCarga()
      })

    const desuscribir = suscribirPartidosPorCategoria(torneoId, categoria, (ps) => {
      if (cancelado) return
      setPartidos(ps)

      const fechas = [...new Set(ps.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
      setFechaSeleccionada((actual) => {
        if (fechas.length === 0) return null
        if (actual && fechas.includes(actual)) return actual
        return fechas[fechas.length - 1]
      })

      partidosListos = true
      intentarTerminarCarga()
    })

    return () => {
      cancelado = true
      desuscribir()
    }
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  // De menor a mayor hora programada - los que todavia no tienen
  // horario puesto quedan al final (mismo criterio que TabFechas admin).
  const partidosDeFecha = partidos
    .filter((p) => p.fechaNumero === fechaSeleccionada)
    .sort((a, b) => (a.fecha?.toMillis?.() ?? Infinity) - (b.fecha?.toMillis?.() ?? Infinity))

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos
      .filter((p) => p.fechaNumero === f)
      .some((p) => p.golesLocal != null || p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
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
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

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
              const enVivo = !jugado && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
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
                    jugado ? 'border-line border-l-success' : enVivo ? 'border-danger/30 border-l-danger' : 'border-dashed border-line border-l-line'
                  }`}
                >
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    {jugado ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Jugado
                      </span>
                    ) : enVivo ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-danger">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> En vivo
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

                  {!jugado && p.fecha && (
                    <p className="px-4 pb-1 text-[11px] font-medium text-ink-soft">
                      🗓 {formatearFechaProgramada(p.fecha)}
                    </p>
                  )}

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
                          jugado ? 'bg-success-soft' : enVivo ? 'bg-danger-soft' : 'bg-paper text-ink-soft'
                        }`}
                      >
                        {jugado ? p.golesLocal : enVivo ? p.golesLocalEnVivo ?? 0 : '–'}
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
                          jugado ? 'bg-success-soft' : enVivo ? 'bg-danger-soft' : 'bg-paper text-ink-soft'
                        }`}
                      >
                        {jugado ? p.golesVisitante : enVivo ? p.golesVisitanteEnVivo ?? 0 : '–'}
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
