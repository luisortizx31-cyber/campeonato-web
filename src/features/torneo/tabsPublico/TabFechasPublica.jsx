import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { suscribirPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { calcularLegPartido, formatearFechaProgramada, formatearDiaCorto, formatearHoraCorta, compararPartidosPorHorario } from '../../../utils/fixtureTorneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { colorEquipo, inicialEquipo } from '../../../utils/colorEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import CanchaPublica from '../CanchaPublica'

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
  // Solo el id, no el partido entero - asi el detalle (CanchaPublica)
  // siempre recibe la version mas actualizada del array ya suscripto
  // en vivo mas abajo, en vez de una copia que se queda vieja.
  const [partidoAbiertoId, setPartidoAbiertoId] = useState(null)
  // Se actualiza solo (cada 1 min) para que la pastilla de una Fecha
  // empiece a parpadear apenas se llega a su horario, sin necesidad de
  // que algun dato del partido cambie mientras tanto (ver horaLlegada).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

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
        // Al entrar a la pestaña (o la primera vez), arranca en la
        // fecha actual que todavia esta por jugarse - no en la ultima
        // del fixture (mismo criterio que TabFechas admin).
        const pendiente = fechas.find((f) => ps.some((p) => p.fechaNumero === f && p.golesLocal == null))
        return pendiente ?? fechas[0]
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

  const partidoAbierto = partidoAbiertoId ? partidos.find((p) => p.id === partidoAbiertoId) : null

  // Si el partido abierto deja de existir (ej. el Maestro lo borro
  // mientras alguien lo miraba), vuelve solo al listado en vez de
  // dejar la pantalla de detalle colgada.
  useEffect(() => {
    if (partidoAbiertoId && !cargando && !partidoAbierto) setPartidoAbiertoId(null)
  }, [partidoAbiertoId, partidoAbierto, cargando])

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  // Pendientes de menor a mayor hora programada primero, los ya
  // jugados al final (mismo criterio que TabFechas admin).
  const partidosDeFecha = partidos
    .filter((p) => p.fechaNumero === fechaSeleccionada)
    .sort(compararPartidosPorHorario)

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos
      .filter((p) => p.fechaNumero === f)
      .some((p) => p.golesLocal != null || p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  }

  // Horario mas temprano entre los partidos de esta Fecha (cualquiera
  // que tenga `fecha` puesto) - se muestra debajo de cada pastilla
  // "Fecha N" para que el publico vea de un vistazo cuando se juega,
  // sin tener que entrar a la fecha.
  function horarioMasBajoDe(f) {
    const conFecha = partidos.filter((p) => p.fechaNumero === f && p.fecha)
    if (conFecha.length === 0) return null
    return conFecha.sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())[0].fecha
  }

  // Ya se llego (o paso) el horario de esta Fecha y todavia no esta
  // completa - la pastilla parpadea para llamar la atencion (ver
  // animate-pulse mas abajo). `ahora` se actualiza solo cada minuto.
  function horaLlegada(f) {
    const horario = horarioMasBajoDe(f)
    return horario != null && horario.toMillis() <= ahora && !fechaCompleta(f)
  }

  function fechaLeg(f) {
    const partidosF = partidos.filter((p) => p.fechaNumero === f)
    if (partidosF.length === 0) return null
    const legs = new Set(partidosF.map((p) => calcularLegPartido(p, partidos)))
    return legs.size === 1 ? [...legs][0] : 'mixta'
  }
  const fechasIda = fechasDisponibles.filter((f) => fechaLeg(f) === 'ida')
  const fechasVuelta = fechasDisponibles.filter((f) => fechaLeg(f) === 'vuelta')

  if (partidoAbiertoId) {
    return partidoAbierto ? (
      <CanchaPublica
        torneoId={torneoId}
        categoria={categoria}
        partido={partidoAbierto}
        nombreEquipo={nombreEquipo}
        onVolver={() => setPartidoAbiertoId(null)}
      />
    ) : null
  }

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
          <div ref={barraFechasRef} className="mb-3 flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {fechasDisponibles.map((f) => {
              const completa = fechaCompleta(f)
              const empezada = !completa && fechaEmpezada(f)
              const esPrimeraVuelta = fechasVuelta.length > 0 && f === Math.min(...fechasVuelta)
              const horarioMasBajo = horarioMasBajoDe(f)
              const enHora = horaLlegada(f)
              return (
                <div key={f} className="flex shrink-0 items-stretch gap-1.5">
                  {esPrimeraVuelta && <span className="w-px shrink-0 bg-line" />}
                  <div className="flex shrink-0 flex-col items-center gap-0.5">
                    <button
                      data-fecha={f}
                      onClick={() => setFechaSeleccionada(f)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        enHora ? 'animate-pulse' : ''
                      } ${
                        fechaSeleccionada === f
                          ? 'border-brand bg-brand text-white'
                          : completa
                            ? 'border-danger/30 bg-danger-soft text-danger'
                            : empezada
                              ? 'border-warning/30 bg-warning-soft text-warning'
                              : 'border-success/30 bg-success-soft text-success'
                      }`}
                    >
                      Fecha {f}{completa ? ' ✓' : ''}
                    </button>
                    {horarioMasBajo && (
                      <div className="flex flex-col items-center whitespace-nowrap rounded-lg bg-gold px-2 py-1 leading-tight text-white shadow-sm">
                        <span className="text-[10px] font-bold">{formatearDiaCorto(horarioMasBajo)}</span>
                        <span className="text-[9px] font-semibold">{formatearHoraCorta(horarioMasBajo)}</span>
                      </div>
                    )}
                  </div>
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
                  onClick={() => setPartidoAbiertoId(p.id)}
                  className={`cursor-pointer overflow-hidden rounded-2xl border border-l-4 bg-surface shadow-sm transition-colors active:bg-ink-soft/5 ${
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
                    <p className="px-4 pb-1">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1 text-[11px] font-medium text-ink-soft">
                        🗓 {formatearFechaProgramada(p.fecha)}
                      </span>
                    </p>
                  )}

                  <div className="mx-4 mb-3 mt-1.5 overflow-hidden rounded-xl border border-line/70 bg-paper">
                    <div className="flex items-center gap-2.5 px-3 py-2">
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
                        className={`money flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border-2 text-center text-lg font-extrabold text-ink ${
                          jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface text-ink-soft/30'
                        }`}
                      >
                        {jugado ? p.golesLocal : enVivo ? p.golesLocalEnVivo ?? 0 : '–'}
                      </span>
                    </div>
                    <div className="border-t border-line/70" />
                    <div className="flex items-center gap-2.5 px-3 py-2">
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
                        className={`money flex h-10 w-14 shrink-0 items-center justify-center rounded-lg border-2 text-center text-lg font-extrabold text-ink ${
                          jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface text-ink-soft/30'
                        }`}
                      >
                        {jugado ? p.golesVisitante : enVivo ? p.golesVisitanteEnVivo ?? 0 : '–'}
                      </span>
                    </div>
                  </div>

                  <p className="border-t border-line px-4 py-1.5 text-right text-[10px] font-medium text-ink-soft">
                    Ver detalle ›
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
