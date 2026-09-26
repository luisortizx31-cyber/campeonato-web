import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { suscribirPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { calcularLegPartido, esFechaLiguilla, etiquetaLiguilla, textoFechas, formatearDiaLargo, formatearHora12, formatearHoraCorta, compararPartidosPorHorario } from '../../../utils/fixtureTorneo'
import { textoMinutoEnCurso } from '../../../utils/golesPorTiempo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
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

  // Arranca mostrando directo los partidos de la fecha actual (no la
  // grilla) - asi el publico no tiene que tocar nada para ver lo que
  // se juega hoy; la grilla queda a un toque con "Todas las fechas".
  const [verGrillaFechas, setVerGrillaFechas] = useState(false)

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
        // Al entrar a la pestaña, arranca en la fecha pendiente cuyo
        // horario programado sea el mas proximo (no simplemente la de
        // menor numero) - asi una fecha reprogramada para mas adelante
        // no tapa a la que en realidad toca jugar hoy (mismo criterio
        // que TabFechas admin). Una fecha pendiente sin horario puesto
        // queda al final de este criterio.
        const pendientes = fechas.filter((f) => ps.some((p) => p.fechaNumero === f && p.golesLocal == null))
        if (pendientes.length === 0) return fechas[0]
        const conHorario = pendientes
          .map((f) => {
            const horarios = ps
              .filter((p) => p.fechaNumero === f && p.golesLocal == null && p.fecha)
              .map((p) => p.fecha.toMillis())
            return { f, horario: horarios.length > 0 ? Math.min(...horarios) : Infinity }
          })
          .sort((a, b) => a.horario - b.horario || a.f - b.f)
        return conHorario[0].f
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

  // Para el chip de dia/hora debajo de la pastilla: si el horario
  // programado ya paso (independiente de si el resultado se cargo o
  // no) se muestra atenuado en vez de dorado, para diferenciar de un
  // vistazo las fechas que todavia estan por jugarse (mismo criterio
  // que TabFechas admin).
  function horarioYaPaso(f) {
    const horario = horarioMasBajoDe(f)
    return horario != null && horario.toMillis() <= ahora
  }

  function fechaLeg(f) {
    const partidosF = partidos.filter((p) => p.fechaNumero === f)
    if (partidosF.length === 0) return null
    const legs = new Set(partidosF.map((p) => calcularLegPartido(p, partidos)))
    return legs.size === 1 ? [...legs][0] : 'mixta'
  }
  // La ida/vuelta de la temporada regular y la de la liguilla se cuentan por
  // separado (la liguilla se muestra como "Liguilla ida" / "Liguilla vuelta").
  const fechasLiguilla = fechasDisponibles.filter((f) => esFechaLiguilla(f, partidos))
  const fechasIda = fechasDisponibles.filter((f) => !fechasLiguilla.includes(f) && fechaLeg(f) === 'ida')
  const fechasVuelta = fechasDisponibles.filter((f) => !fechasLiguilla.includes(f) && fechaLeg(f) === 'vuelta')
  const fechasLiguillaIda = fechasLiguilla.filter((f) => fechaLeg(f) === 'ida')
  const fechasLiguillaVuelta = fechasLiguilla.filter((f) => fechaLeg(f) === 'vuelta')

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
          {verGrillaFechas ? (
            <>
              {fechasVuelta.length > 0 && (
                <p className="mb-2 text-xs text-ink-soft">
                  <span className="font-semibold text-brand">Ida:</span> Fecha {Math.min(...fechasIda)}–{Math.max(...fechasIda)}
                  {'  ·  '}
                  <span className="font-semibold text-gold">Vuelta:</span> Fecha {Math.min(...fechasVuelta)}–{Math.max(...fechasVuelta)}
                </p>
              )}
              {fechasLiguilla.length > 0 && (
                <p className="mb-2 text-xs text-ink-soft">
                  <span className="font-semibold text-danger">Liguilla</span>
                  {fechasLiguillaIda.length > 0 && <> · ida: {textoFechas(fechasLiguillaIda)}</>}
                  {fechasLiguillaVuelta.length > 0 && <> · vuelta: {textoFechas(fechasLiguillaVuelta)}</>}
                  {fechasLiguillaIda.length === 0 && fechasLiguillaVuelta.length === 0 && <> · {textoFechas(fechasLiguilla)}</>}
                </p>
              )}
              <div className="mb-3 flex flex-col gap-2">
                {fechasDisponibles.map((f) => {
                  const completa = fechaCompleta(f)
                  const empezada = !completa && fechaEmpezada(f)
                  const esLiguillaF = fechasLiguilla.includes(f)
                  const horarioMasBajo = horarioMasBajoDe(f)
                  const enHora = horaLlegada(f)
                  const activa = fechaSeleccionada === f
                  const cuando = horarioMasBajo
                    ? `${formatearDiaLargo(horarioMasBajo)} · ${formatearHora12(horarioMasBajo)}`
                    : null
                  const descripcion = completa
                    ? cuando
                      ? `Se jugó el ${cuando}`
                      : 'Jugada'
                    : empezada
                      ? 'En curso'
                      : enHora
                        ? 'Se juega hoy'
                        : cuando
                          ? `Por jugarse el ${cuando}`
                          : 'Sin programar'
                  return (
                    <button
                      key={f}
                      onClick={() => {
                        setFechaSeleccionada(f)
                        setVerGrillaFechas(false)
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-full border px-5 py-3 text-left transition-all ${
                        enHora ? 'animate-pulse' : ''
                      } ${
                        activa
                          ? 'border-brand bg-brand text-white shadow-sm'
                          : completa
                            ? 'border-danger/30 bg-danger-soft text-danger'
                            : empezada
                              ? 'border-warning/30 bg-warning-soft text-warning'
                              : enHora
                                ? 'border-success/30 bg-success-soft text-success'
                                : 'border-line bg-surface text-ink-soft'
                      }`}
                    >
                      <span className="shrink-0 whitespace-nowrap text-base font-extrabold">
                        {esLiguillaF ? `${etiquetaLiguilla(fechaLeg(f))} · Fecha ${f}` : `Fecha ${f}`}{completa ? ' ✓' : ''}
                      </span>
                      <span className={`flex-1 text-right text-xs font-semibold ${activa ? 'text-white/90' : ''}`}>{descripcion}</span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setVerGrillaFechas(true)}
                className="mb-3 flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95"
              >
                ← Todas las fechas
              </button>

              <div className="mb-3 rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-brand">Fecha {fechaSeleccionada}</p>
                {horarioMasBajoDe(fechaSeleccionada) ? (
                  <>
                    <p className="text-lg font-extrabold uppercase leading-tight tracking-wide text-ink">
                      {formatearDiaLargo(horarioMasBajoDe(fechaSeleccionada))}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-soft">
                      {horarioYaPaso(fechaSeleccionada) ? 'Empezó' : 'Empieza'} a las{' '}
                      {formatearHora12(horarioMasBajoDe(fechaSeleccionada))}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-ink-soft">Todavía sin programar</p>
                )}
              </div>

              <ul className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" {...swipeFecha}>
                {partidosDeFecha.map((p) => {
                  const jugado = p.golesLocal != null && p.golesVisitante != null
                  const enVivo = !jugado && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
                  const ganoLocal = jugado && p.golesLocal > p.golesVisitante
                  const ganoVisitante = jugado && p.golesVisitante > p.golesLocal
                  const equipoLocal = equipos.find((e) => e.id === p.equipoLocalId)
                  const equipoVisitante = equipos.find((e) => e.id === p.equipoVisitanteId)
                  const nombreLocal = equipoLocal?.nombre || '—'
                  const nombreVisitante = equipoVisitante?.nombre || '—'
                  return (
                    <li
                      key={p.id}
                      onClick={() => setPartidoAbiertoId(p.id)}
                      className="cursor-pointer border-t border-line px-2.5 py-3 first:border-t-0 active:bg-ink-soft/5"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-1.5">
                        <div className="flex min-w-0 items-center justify-end gap-1.5">
                          <span className={`min-w-0 break-words text-right text-[13px] leading-tight text-ink ${ganoLocal ? 'font-bold' : ''}`}>
                            {nombreLocal}
                          </span>
                          <EscudoEquipo nombre={nombreLocal} fotoUrl={equipoLocal?.fotoPortadaUrl} tamanoClase="h-11 w-11" textoClase="text-base" />
                        </div>

                        <div className="text-center">
                          {!jugado && !enVivo ? (
                            <p className="text-base font-semibold text-ink">{p.fecha ? formatearHoraCorta(p.fecha) : '–'}</p>
                          ) : (
                            <>
                              <p className={`text-2xl font-semibold leading-none tabular-nums ${enVivo ? 'text-danger' : 'text-ink'}`}>
                                {jugado ? p.golesLocal : p.golesLocalEnVivo ?? 0} - {jugado ? p.golesVisitante : p.golesVisitanteEnVivo ?? 0}
                              </p>
                              {jugado ? (
                                <p className="mt-1 text-[11px] font-medium tracking-wide text-ink-soft">FIN</p>
                              ) : (
                                <p className="mt-1 flex items-center justify-center gap-1 text-[11px] font-bold tracking-wide text-danger">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                                  {textoMinutoEnCurso(p, ahora) || 'EN VIVO'}
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex min-w-0 items-center gap-1.5">
                          <EscudoEquipo nombre={nombreVisitante} fotoUrl={equipoVisitante?.fotoPortadaUrl} tamanoClase="h-11 w-11" textoClase="text-base" />
                          <span className={`min-w-0 break-words text-left text-[13px] leading-tight text-ink ${ganoVisitante ? 'font-bold' : ''}`}>
                            {nombreVisitante}
                          </span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
