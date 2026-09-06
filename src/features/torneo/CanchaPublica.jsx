import { useEffect, useState } from 'react'
import { listarJugadoresPorEquipo } from '../../services/torneoJugadoresService'
import { suscribirGolesPorPartido } from '../../services/torneoGolesService'
import { suscribirTarjetasPorPartido } from '../../services/torneoTarjetasService'
import { obtenerConfigCategoria } from '../../services/torneoConfigService'
import { TIPO_TARJETA } from '../../models/torneo'
import { colorEquipo } from '../../utils/colorEquipo'
import { nombreCorto } from '../../utils/nombreJugador'

// Fila de solo lectura de la cancha (ver FilaAccion en ControlPartido,
// del que esta es la version publica): mismo numero+nombre+goles/
// amarillas, sin los botones de cargar gol/tarjeta.
function FilaAccionPublica({ jugador, nGoles, amarillasPartido }) {
  return (
    <li className="flex items-center justify-between gap-1.5 px-2.5 py-2">
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
        {jugador.numeroCamiseta != null && <span className="text-ink-soft">#{jugador.numeroCamiseta} </span>}
        {nombreCorto(jugador.nombre)}
      </span>
      {(nGoles > 0 || amarillasPartido > 0) && (
        <span className="flex shrink-0 items-center gap-1 text-[11px]">
          {nGoles > 0 && <span className="font-semibold text-brand">⚽{nGoles}</span>}
          {Array.from({ length: amarillasPartido }).map((_, i) => (
            <span key={i}>🟨</span>
          ))}
        </span>
      )}
    </li>
  )
}

/**
 * Version de SOLO LECTURA de la pestaña Cancha de ControlPartido, para
 * que el publico pueda tocar un partido desde TabFechasPublica y ver
 * el mismo detalle en vivo (marcador, quien esta en cancha, goles,
 * tarjetas, walkover) sin ningun boton de accion - nada de cargar
 * goles/tarjetas, finalizar, reiniciar, ni armar alineacion. No
 * comparte JSX con ControlPartido (mismo patron que el resto de la
 * app entre un tab admin y su par publico) para no arriesgar el admin.
 *
 * `partido` viene de TabFechasPublica, que ya lo trae en vivo via
 * suscribirPartidosPorCategoria - por eso titularesLocal/Visitante se
 * leen directo del prop, sin fetch propio. Los goles y tarjetas si se
 * suscriben aca, por partido.
 */
export default function CanchaPublica({ torneoId, categoria, partido, nombreEquipo, onVolver }) {
  const [jugadoresLocal, setJugadoresLocal] = useState([])
  const [jugadoresVisitante, setJugadoresVisitante] = useState([])
  const [goles, setGoles] = useState([])
  const [tarjetas, setTarjetas] = useState([])
  const [minimoJugadoresCancha, setMinimoJugadoresCancha] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    Promise.all([
      listarJugadoresPorEquipo(partido.equipoLocalId),
      listarJugadoresPorEquipo(partido.equipoVisitanteId),
      obtenerConfigCategoria(torneoId, categoria),
    ])
      .then(([jl, jv, cfg]) => {
        if (cancelado) return
        setJugadoresLocal(jl.filter((j) => !j.eliminado))
        setJugadoresVisitante(jv.filter((j) => !j.eliminado))
        setMinimoJugadoresCancha(cfg.minimoJugadoresCancha)
      })
      .catch((err) => console.error('[CanchaPublica]', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria, partido.equipoLocalId, partido.equipoVisitanteId])

  useEffect(() => {
    return suscribirGolesPorPartido(partido.id, setGoles)
  }, [partido.id])

  useEffect(() => {
    return suscribirTarjetasPorPartido(partido.id, setTarjetas)
  }, [partido.id])

  const golesLocalCount = goles
    .filter((g) => g.equipoId === partido.equipoLocalId)
    .reduce((s, g) => s + (g.cantidad || 0), 0)
  const golesVisitanteCount = goles
    .filter((g) => g.equipoId === partido.equipoVisitanteId)
    .reduce((s, g) => s + (g.cantidad || 0), 0)

  function golesDe(jugadorId) {
    return goles.filter((g) => g.jugadorId === jugadorId).reduce((s, g) => s + (g.cantidad || 0), 0)
  }
  function tarjetasDe(jugadorId) {
    return tarjetas.filter((t) => t.jugadorId === jugadorId)
  }

  function estaExpulsadoEnPartido(jugadorId) {
    const cartas = tarjetasDe(jugadorId)
    const amarillas = cartas.filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length
    const roja = cartas.some((t) => t.tipo === TIPO_TARJETA.ROJA)
    return roja || amarillas >= 2
  }

  const expulsadosLocal = jugadoresLocal.filter((j) => estaExpulsadoEnPartido(j.id))
  const expulsadosVisitante = jugadoresVisitante.filter((j) => estaExpulsadoEnPartido(j.id))

  const amarillasLocal = jugadoresLocal.filter(
    (j) => !estaExpulsadoEnPartido(j.id) && tarjetasDe(j.id).some((t) => t.tipo === TIPO_TARJETA.AMARILLA)
  )
  const amarillasVisitante = jugadoresVisitante.filter(
    (j) => !estaExpulsadoEnPartido(j.id) && tarjetasDe(j.id).some((t) => t.tipo === TIPO_TARJETA.AMARILLA)
  )

  const goleadoresLocal = jugadoresLocal.filter((j) => golesDe(j.id) > 0)
  const goleadoresVisitante = jugadoresVisitante.filter((j) => golesDe(j.id) > 0)

  const enCanchaLocal = jugadoresLocal.filter(
    (j) => partido.titularesLocal?.includes(j.id) && !estaExpulsadoEnPartido(j.id)
  )
  const enCanchaVisitante = jugadoresVisitante.filter(
    (j) => partido.titularesVisitante?.includes(j.id) && !estaExpulsadoEnPartido(j.id)
  )

  // Exige que el partido ya haya arrancado (ver ControlPartido ->
  // "Arrancar partido") - si no, un equipo con la alineacion todavia
  // sin armar (0 titulares, no por expulsiones) disparaba el aviso de
  // walkover antes de tiempo.
  const abandonoLocal = partido.horaInicio != null && minimoJugadoresCancha != null && enCanchaLocal.length < minimoJugadoresCancha
  const abandonoVisitante = partido.horaInicio != null && minimoJugadoresCancha != null && enCanchaVisitante.length < minimoJugadoresCancha

  const colorLocal = colorEquipo(nombreEquipo(partido.equipoLocalId))
  const colorVisitante = colorEquipo(nombreEquipo(partido.equipoVisitanteId))

  const jugado = partido.golesLocal != null
  const enVivo = !jugado && (partido.titularesLocal?.length > 0 || partido.titularesVisitante?.length > 0)

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onVolver}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft"
        >
          ← Volver
        </button>
        <p className="text-xs text-ink-soft">Fecha {partido.fechaNumero}</p>
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
      </div>

      <div className="mb-3 rounded-2xl border border-line bg-brand-dark p-4 text-center text-white">
        <p className="text-[10px] uppercase tracking-widest text-white/70">Marcador en vivo</p>
        <p className="mt-1 text-3xl font-bold">
          {jugado ? partido.golesLocal : golesLocalCount} — {jugado ? partido.golesVisitante : golesVisitanteCount}
        </p>
        <p className="mt-1 truncate text-xs text-white/70">
          {nombreEquipo(partido.equipoLocalId)} vs {nombreEquipo(partido.equipoVisitanteId)}
        </p>
      </div>

      {cargando ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : (
        <>
          {(abandonoLocal || abandonoVisitante) && (
            <div className="mb-3 space-y-2">
              {abandonoLocal && (
                <div className="rounded-2xl border border-danger bg-danger px-4 py-3 text-white">
                  <p className="text-sm font-semibold">
                    ⚠️ {nombreEquipo(partido.equipoLocalId)} se quedó con {enCanchaLocal.length} jugador
                    {enCanchaLocal.length === 1 ? '' : 'es'} en cancha (mínimo {minimoJugadoresCancha}).
                  </p>
                </div>
              )}
              {abandonoVisitante && (
                <div className="rounded-2xl border border-danger bg-danger px-4 py-3 text-white">
                  <p className="text-sm font-semibold">
                    ⚠️ {nombreEquipo(partido.equipoVisitanteId)} se quedó con {enCanchaVisitante.length} jugador
                    {enCanchaVisitante.length === 1 ? '' : 'es'} en cancha (mínimo {minimoJugadoresCancha}).
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-brand-dark p-1">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className={`truncate px-2 py-1.5 text-center text-[11px] font-bold text-ink ${colorLocal.bg}`}>
                {nombreEquipo(partido.equipoLocalId)} ({enCanchaLocal.length})
              </div>
              <ul className="divide-y-2 divide-ink-soft/20">
                {enCanchaLocal.map((j) => (
                  <FilaAccionPublica key={j.id} jugador={j} nGoles={golesDe(j.id)} amarillasPartido={tarjetasDe(j.id).filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length} />
                ))}
                {enCanchaLocal.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Elegí titulares en Alineación</li>
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className={`truncate px-2 py-1.5 text-center text-[11px] font-bold text-ink ${colorVisitante.bg}`}>
                {nombreEquipo(partido.equipoVisitanteId)} ({enCanchaVisitante.length})
              </div>
              <ul className="divide-y-2 divide-ink-soft/20">
                {enCanchaVisitante.map((j) => (
                  <FilaAccionPublica key={j.id} jugador={j} nGoles={golesDe(j.id)} amarillasPartido={tarjetasDe(j.id).filter((t) => t.tipo === TIPO_TARJETA.AMARILLA).length} />
                ))}
                {enCanchaVisitante.length === 0 && (
                  <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Elegí titulares en Alineación</li>
                )}
              </ul>
            </div>
          </div>

          {[
            { equipoId: partido.equipoLocalId, color: colorLocal, expulsados: expulsadosLocal, amarillas: amarillasLocal, goleadores: goleadoresLocal },
            { equipoId: partido.equipoVisitanteId, color: colorVisitante, expulsados: expulsadosVisitante, amarillas: amarillasVisitante, goleadores: goleadoresVisitante },
          ].map(({ equipoId, color, expulsados, amarillas, goleadores }) => (
            (expulsados.length > 0 || amarillas.length > 0 || goleadores.length > 0) && (
              <div key={equipoId} className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface">
                <p className={`truncate px-3 py-1.5 text-center text-xs font-bold ${color.bg} ${color.text}`}>
                  {nombreEquipo(equipoId)}
                </p>
                <div className="divide-y divide-line">
                  {expulsados.length > 0 && (
                    <div className="px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold text-danger">🟥 Expulsados</p>
                      <ul className="space-y-1">
                        {expulsados.map((j) => {
                          const roja = tarjetasDe(j.id).some((t) => t.tipo === TIPO_TARJETA.ROJA)
                          return (
                            <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 truncate font-semibold text-ink">{j.nombre}</span>
                              <span className="shrink-0 text-danger">{roja ? 'Roja directa' : '2 amarillas'}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  {amarillas.length > 0 && (
                    <div className="px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold text-warning">🟨 Amarillas</p>
                      <ul className="space-y-1">
                        {amarillas.map((j) => (
                          <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-semibold text-ink">{j.nombre}</span>
                            <span className="shrink-0 text-warning">1 amarilla</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {goleadores.length > 0 && (
                    <div className="px-3 py-2">
                      <p className="mb-1 text-[11px] font-semibold text-brand">⚽ Goleadores</p>
                      <ul className="space-y-1">
                        {goleadores.map((j) => (
                          <li key={j.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-semibold text-ink">{j.nombre}</span>
                            <span className="shrink-0 font-semibold text-brand">⚽ {golesDe(j.id)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          ))}
        </>
      )}
    </div>
  )
}
