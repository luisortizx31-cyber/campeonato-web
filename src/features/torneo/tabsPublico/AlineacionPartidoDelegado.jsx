import { useEffect, useState } from 'react'
import { actualizarTitular, actualizarSuplente } from '../../../services/torneoPartidosService'
import { actualizarNumeroCamiseta, listarJugadoresPorEquipo } from '../../../services/torneoJugadoresService'
import {
  crearSolicitudCambio,
  suscribirSolicitudesPorPartidoYEquipo,
  marcarSolicitudVista,
} from '../../../services/torneoSolicitudesCambioService'

function porNombre(a, b) {
  return a.nombre.localeCompare(b.nombre)
}

// Input de numero de camiseta con estado local propio (igual que
// FilaAlineacion en ControlPartido) - asi cada tecla que se escribe no
// depende de un re-render del padre, y onBlur recien ahi dispara el
// guardado. Si el guardado falla (ej. numero repetido en el equipo, o
// el Maestro cerro las inscripciones), vuelve al valor anterior.
function InputCamiseta({ jugador, onGuardar, disabled }) {
  const [numero, setNumero] = useState(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')

  useEffect(() => {
    setNumero(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')
  }, [jugador.numeroCamiseta])

  async function guardar() {
    const actual = jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : ''
    if (numero.trim() === actual) return
    const ok = await onGuardar(jugador.id, numero.trim())
    if (!ok) setNumero(actual)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      value={numero}
      onChange={(e) => setNumero(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur()
      }}
      disabled={disabled}
      placeholder="#"
      title="Número de camiseta"
      className="no-spinner w-12 shrink-0 rounded-md border border-line bg-paper px-1 py-1.5 text-center text-sm font-medium text-ink outline-none focus-visible:border-brand disabled:opacity-60"
    />
  )
}

/**
 * Selector de titulares/suplentes para el delegado (ver
 * TabMiEquipoDelegado) - version simplificada de SelectorAlineacion
 * (ControlPartido), sin el check de "trajo DNI hoy" (eso es una
 * verificacion del dia del partido en la cancha, no tiene sentido acá)
 * y sin la seccion de expulsados (eso es estado EN VIVO del partido,
 * el delegado arma esto de antemano). Solo funciona mientras el
 * Maestro tenga la alineacion abierta para este equipo (ver
 * ControlPartido y firestore.rules) - si la cierra en el medio, el
 * proximo intento de guardar simplemente falla con un error.
 *
 * Mientras el partido no arranco (partido.horaInicio == null, ver
 * ControlPartido -> "Arrancar partido") el delegado edita la
 * alineacion directo, como siempre. Una vez arrancado, tocar a un
 * titular ya no lo mueve directo - abre un pedido de cambio que el
 * Maestro tiene que aprobar desde ControlPartido (ver
 * torneoSolicitudesCambioService), para que un jugador que no llego no
 * quede sin poder resolverse pero tampoco se meta un cambio sin que el
 * Maestro se entere en medio del partido.
 */
export default function AlineacionPartidoDelegado({ torneoId, categoria, equipoId, partido, equipo, jugadores: jugadoresIniciales, jugadoresPorEquipo, nombreEquipoPropio, nombreRival, onVolver }) {
  // Que pestaña se ve - igual que ControlPartido (admin): arranca en
  // Cancha si la alineacion ya estaba armada (se volvio a abrir un
  // partido en curso), si no en Alineación, que es el primer paso.
  const [vista, setVista] = useState(() =>
    ((equipo === 'local' ? partido.titularesLocal : partido.titularesVisitante)?.length > 0) ? 'cancha' : 'alineacion'
  )
  const rivalId = equipo === 'local' ? partido.equipoVisitanteId : partido.equipoLocalId
  const [jugadoresRival, setJugadoresRival] = useState([])
  const [titulares, setTitulares] = useState(
    (equipo === 'local' ? partido.titularesLocal : partido.titularesVisitante) || []
  )
  const [suplentes, setSuplentes] = useState(
    (equipo === 'local' ? partido.suplentesLocal : partido.suplentesVisitante) || []
  )
  // Copia local (no la prop directo) para poder reflejar al toque un
  // numero de camiseta recien guardado - mismo motivo que
  // jugadoresLocal/Visitante en ControlPartido.
  const [jugadores, setJugadores] = useState(jugadoresIniciales)
  const [error, setError] = useState(null)
  // Titular tocado - en vez de mandarlo directo a Suplente, abre un
  // selector con las dos opciones (mismo criterio que "Pasa al banco" /
  // "Sale del partido" del cambio en ControlPartido), para no perder de
  // vista a alguien que en realidad no sigue convocado para este
  // partido.
  const [cambio, setCambio] = useState(null)
  const [solicitudes, setSolicitudes] = useState([])
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  // Optimista - la marca real (vistoPorDelegado) queda guardada en el
  // propio doc de Firestore al tocar la "x" (ver handleCerrarAviso),
  // para que un pedido ya visto no vuelva a aparecer al salir y volver
  // a entrar a esta pantalla, o desde otro dispositivo.
  const [solicitudesDescartadas, setSolicitudesDescartadas] = useState([])

  // El partido puede seguir actualizandose (ver TabMiEquipoDelegado,
  // suscrito en vivo) mientras esta pantalla queda abierta - sin esto,
  // un cambio que el Maestro apruebe desde ControlPartido no se
  // reflejaria aca hasta salir y volver a entrar.
  useEffect(() => {
    setTitulares((equipo === 'local' ? partido.titularesLocal : partido.titularesVisitante) || [])
    setSuplentes((equipo === 'local' ? partido.suplentesLocal : partido.suplentesVisitante) || [])
  }, [partido.titularesLocal, partido.titularesVisitante, partido.suplentesLocal, partido.suplentesVisitante, equipo])

  useEffect(() => {
    const desuscribir = suscribirSolicitudesPorPartidoYEquipo(partido.id, equipoId, setSolicitudes)
    return desuscribir
  }, [partido.id, equipoId])

  // Solo para MOSTRAR en la vista Cancha (ver mas abajo) - el rival se
  // ve, pero nunca se puede tocar ni pedir cambios de su plantel.
  useEffect(() => {
    let cancelado = false
    listarJugadoresPorEquipo(rivalId).then((js) => {
      if (!cancelado) setJugadoresRival(js.filter((j) => !j.eliminado))
    })
    return () => {
      cancelado = true
    }
  }, [rivalId])

  const enVivo = partido.horaInicio != null && partido.golesLocal == null
  // Terminado el partido, la alineacion queda como historial - ya no
  // se puede tocar nada, ni siquiera con la via "directa" de antes de
  // arrancar (que si no, volveria a estar disponible sola apenas
  // termina, porque en ese momento enVivo pasa a false).
  const finalizado = partido.golesLocal != null
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === 'pendiente')
  const solicitudesResueltas = solicitudes.filter(
    (s) => s.estado !== 'pendiente' && !s.vistoPorDelegado && !solicitudesDescartadas.includes(s.id)
  )

  function handleCerrarAviso(solicitudId) {
    setSolicitudesDescartadas((d) => [...d, solicitudId])
    marcarSolicitudVista(solicitudId).catch((err) =>
      console.error('[AlineacionPartidoDelegado] marcarSolicitudVista', err)
    )
  }

  async function mover(jugadorId, nuevoEstado) {
    if (finalizado) return
    const nuevosTitulares = nuevoEstado === 'titular' ? [...new Set([...titulares, jugadorId])] : titulares.filter((id) => id !== jugadorId)
    const nuevosSuplentes = nuevoEstado === 'suplente' ? [...new Set([...suplentes, jugadorId])] : suplentes.filter((id) => id !== jugadorId)
    setTitulares(nuevosTitulares)
    setSuplentes(nuevosSuplentes)
    setError(null)
    try {
      await Promise.all([
        actualizarTitular(partido.id, equipo, jugadorId, nuevoEstado === 'titular'),
        actualizarSuplente(partido.id, equipo, jugadorId, nuevoEstado === 'suplente'),
      ])
    } catch (err) {
      console.error('[AlineacionPartidoDelegado]', err)
      setError('No se pudo guardar - puede que el Maestro haya cerrado el acceso. Volvé a intentar o consultale.')
    }
  }

  // No puede repetirse un numero dentro del propio equipo - mismo
  // chequeo que ControlPartido, optimista con reversion si falla (ver
  // InputCamiseta).
  async function handleGuardarCamiseta(jugadorId, valor) {
    if (finalizado) return false
    const numero = valor === '' ? null : Number(valor)
    if (numero != null) {
      const duplicado = jugadores.find((j) => j.id !== jugadorId && j.numeroCamiseta != null && Number(j.numeroCamiseta) === numero)
      if (duplicado) {
        setError(`El número ${numero} ya lo tiene ${duplicado.nombre}.`)
        return false
      }
    }
    setError(null)
    setJugadores((js) => js.map((j) => (j.id === jugadorId ? { ...j, numeroCamiseta: numero } : j)))
    try {
      await actualizarNumeroCamiseta(jugadorId, numero)
      return true
    } catch (err) {
      console.error('[AlineacionPartidoDelegado] handleGuardarCamiseta', err)
      setError('No se pudo guardar el número de camiseta - puede que el Maestro haya cerrado las inscripciones.')
      return false
    }
  }

  async function handleMoverDesdeCambio(nuevoEstado) {
    if (!cambio) return
    const jugadorId = cambio.id
    setCambio(null)
    await mover(jugadorId, nuevoEstado)
  }

  // El partido ya arranco - en vez de aplicar el cambio directo, queda
  // pedido para que el Maestro lo apruebe desde ControlPartido (ver
  // torneoSolicitudesCambioService.aprobarSolicitud). jugadorEntraId
  // puede venir null - "sacarlo sin reemplazo", para cuando no hay
  // (o no se quiere usar) un suplente convocado; sin esto el delegado
  // quedaba sin ninguna forma de sacar a un titular una vez en vivo si
  // no habia suplentes, a diferencia del Maestro que siempre puede.
  async function handlePedirCambio(jugadorEntraId) {
    if (!cambio || finalizado) return
    // Ninguno de los dos jugadores del pedido puede estar YA metido en
    // otro pedido pendiente - sin esto, se podia mandar "entra LUIS"
    // varias veces para reemplazar a titulares distintos, y LUIS solo
    // puede ocupar un lugar a la vez.
    const yaTienePedidoPendiente = solicitudesPendientes.some(
      (s) =>
        s.jugadorSaleId === cambio.id ||
        s.jugadorEntraId === cambio.id ||
        (jugadorEntraId != null && (s.jugadorSaleId === jugadorEntraId || s.jugadorEntraId === jugadorEntraId))
    )
    if (yaTienePedidoPendiente) {
      setError('Ya hay un pedido pendiente con uno de estos dos jugadores - esperá a que el Maestro lo resuelva antes de mandar otro.')
      return
    }
    setEnviandoSolicitud(true)
    setError(null)
    try {
      await crearSolicitudCambio({
        torneoId,
        categoria,
        partidoId: partido.id,
        equipo,
        equipoId,
        jugadorSaleId: cambio.id,
        jugadorEntraId,
      })
      setCambio(null)
    } catch (err) {
      console.error('[AlineacionPartidoDelegado] handlePedirCambio', err)
      setError('No se pudo enviar el pedido de cambio. Probá de nuevo o avisale al Maestro directamente.')
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  const listaTitulares = jugadores.filter((j) => titulares.includes(j.id)).sort(porNombre)
  const listaSuplentes = jugadores.filter((j) => suplentes.includes(j.id)).sort(porNombre)
  const listaPool = jugadores.filter((j) => !titulares.includes(j.id) && !suplentes.includes(j.id)).sort(porNombre)
  const completo = titulares.length >= jugadoresPorEquipo

  // Vista Cancha: quienes estan jugando ahora mismo de cada lado -
  // tocar a uno de mi equipo abre el mismo selector de cambio que en
  // Alineación (setCambio); el rival solo se muestra, nunca se toca.
  const titularesRivalIds = equipo === 'local' ? partido.titularesVisitante : partido.titularesLocal
  const enCanchaRival = jugadoresRival.filter((j) => titularesRivalIds?.includes(j.id)).sort(porNombre)

  function nombreJugador(jugadorId) {
    return jugadores.find((j) => j.id === jugadorId)?.nombre || '—'
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onVolver}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft"
        >
          ← Volver
        </button>
        <p className="truncate text-xs text-ink-soft">Fecha {partido.fechaNumero} vs {nombreRival}</p>
      </div>

      <div className="mb-3 flex overflow-hidden rounded-xl border border-line">
        <button
          onClick={() => setVista('alineacion')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            vista === 'alineacion' ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
          }`}
        >
          Alineación
        </button>
        <button
          onClick={() => setVista('cancha')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            vista === 'cancha' ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
          }`}
        >
          Cancha
        </button>
      </div>

      <p className="mb-3 text-sm text-ink-soft">
        Elegí quiénes juegan este partido. Titulares:{' '}
        <strong className={completo ? 'text-success' : 'text-ink'}>{titulares.length}/{jugadoresPorEquipo}</strong>
      </p>

      {enVivo && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
          🔴 El partido ya arrancó - para sacar a un titular ahora tenés que pedirle el cambio al Maestro.
        </p>
      )}

      {finalizado && (
        <p className="mb-3 rounded-lg bg-ink-soft/10 px-3 py-2 text-xs font-medium text-ink-soft">
          🏁 Partido finalizado - esto queda como historial, ya no se pueden hacer más cambios.
        </p>
      )}

      {solicitudesResueltas.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {solicitudesResueltas.map((s) => (
            <div
              key={s.id}
              className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                s.estado === 'aprobada' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
              }`}
            >
              <span>
                {s.estado === 'aprobada' ? '✅ El Maestro aprobó tu pedido' : '❌ El Maestro rechazó tu pedido'}: sale{' '}
                {nombreJugador(s.jugadorSaleId)}
                {s.jugadorEntraId ? `, entra ${nombreJugador(s.jugadorEntraId)}.` : ' (sin reemplazo).'}
              </span>
              <button
                onClick={() => handleCerrarAviso(s.id)}
                className="shrink-0 text-sm leading-none opacity-70"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {solicitudesPendientes.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {solicitudesPendientes.map((s) => (
            <p key={s.id} className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              ⏳ Pedido pendiente: sale {nombreJugador(s.jugadorSaleId)}
              {s.jugadorEntraId ? `, entra ${nombreJugador(s.jugadorEntraId)}` : ' (sin reemplazo)'} - esperando que el
              Maestro lo apruebe.
            </p>
          ))}
        </div>
      )}

      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {vista === 'alineacion' ? (
        <>
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            ◌ Jugadores ({listaPool.length})
          </h2>
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {listaPool.map((j) => (
              <li key={j.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{j.nombre}</span>
                <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} disabled={finalizado} />
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => mover(j.id, 'titular')}
                    disabled={completo || finalizado}
                    className="rounded-md border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Titular
                  </button>
                  <button
                    onClick={() => mover(j.id, 'suplente')}
                    disabled={finalizado}
                    className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Suplente
                  </button>
                </div>
              </li>
            ))}
            {listaPool.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-ink-soft">Ya asignaste a todo el plantel</li>
            )}
          </ul>

          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            ● Titulares ({listaTitulares.length})
          </h2>
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {listaTitulares.map((j, i) => (
              <li key={j.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-white">
                  {i + 1}
                </span>
                <button
                  onClick={() => setCambio(j)}
                  disabled={finalizado}
                  className="min-w-0 flex-1 text-left text-sm text-ink disabled:opacity-70"
                >
                  {j.nombre}
                </button>
                <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} disabled={finalizado} />
              </li>
            ))}
            {listaTitulares.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-ink-soft">Sin titulares todavía</li>
            )}
          </ul>

          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
            ○ Suplentes ({listaSuplentes.length})
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {listaSuplentes.map((j) => (
              <li key={j.id} className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => mover(j.id, 'titular')}
                  disabled={completo || finalizado}
                  className="min-w-0 flex-1 text-left text-sm text-ink-soft disabled:opacity-50"
                >
                  ○ {j.nombre}
                </button>
                <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} disabled={finalizado} />
              </li>
            ))}
            {listaSuplentes.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-ink-soft">Sin suplentes todavía</li>
            )}
          </ul>
        </>
      ) : (
        // Vista Cancha: solo lectura del lado del rival - tocar a uno
        // de mi equipo abre el mismo selector de cambio de arriba
        // (setCambio), pedirle un cambio a la OTRA promo no es una
        // opcion en ningun lado de esta pantalla.
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-brand-dark p-1">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="truncate bg-brand-soft px-2 py-1.5 text-center text-[11px] font-bold text-ink">
              {nombreEquipoPropio || 'Mi equipo'} ({listaTitulares.length})
            </div>
            <ul className="divide-y-2 divide-ink-soft/20">
              {listaTitulares.map((j) => (
                <li key={j.id} className="px-2.5 py-2">
                  <button
                    onClick={() => setCambio(j)}
                    disabled={finalizado}
                    className="flex w-full items-center gap-1.5 text-left text-xs disabled:opacity-70"
                  >
                    {j.numeroCamiseta != null && <span className="text-ink-soft">#{j.numeroCamiseta} </span>}
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{j.nombre}</span>
                  </button>
                </li>
              ))}
              {listaTitulares.length === 0 && (
                <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Elegí titulares en Alineación</li>
              )}
            </ul>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="truncate bg-gold-soft px-2 py-1.5 text-center text-[11px] font-bold text-ink">
              {nombreRival} ({enCanchaRival.length})
            </div>
            <ul className="divide-y-2 divide-ink-soft/20">
              {enCanchaRival.map((j) => (
                <li key={j.id} className="px-2.5 py-2 text-xs">
                  {j.numeroCamiseta != null && <span className="text-ink-soft">#{j.numeroCamiseta} </span>}
                  <span className="font-medium text-ink">{j.nombre}</span>
                </li>
              ))}
              {enCanchaRival.length === 0 && (
                <li className="px-2.5 py-3 text-center text-[11px] text-ink-soft">Todavía sin titulares</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {cambio && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
              <h1 className="text-base font-semibold text-ink">¿Qué hacemos con {cambio.nombre}?</h1>
              <button onClick={() => setCambio(null)} className="text-2xl leading-none text-ink-soft px-1">×</button>
            </div>
            {enVivo ? (
              <div className="p-4">
                {solicitudesPendientes.some((s) => s.jugadorSaleId === cambio.id) ? (
                  <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                    Ya hay un pedido pendiente para sacar a {cambio.nombre} - esperá a que el Maestro lo apruebe.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-ink-soft">
                      El partido ya arrancó - esto le queda pedido al Maestro, no se aplica hasta que lo apruebe.
                    </p>
                    <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
                      {listaSuplentes.length === 0 && (
                        <li className="px-4 py-3 text-center text-xs text-ink-soft">
                          No tenés suplentes convocados para reemplazarlo.
                        </li>
                      )}
                      {listaSuplentes.map((s) => {
                        // Ya metido en otro pedido pendiente (como el
                        // que sale o el que entra) - no se puede
                        // volver a elegir hasta que el Maestro lo
                        // resuelva, si no un mismo jugador podria
                        // quedar pedido para entrar por dos titulares
                        // distintos a la vez.
                        const yaTienePedido = solicitudesPendientes.some(
                          (sol) => sol.jugadorEntraId === s.id || sol.jugadorSaleId === s.id
                        )
                        return (
                          <li key={s.id}>
                            <button
                              onClick={() => handlePedirCambio(s.id)}
                              disabled={enviandoSolicitud || yaTienePedido}
                              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <span className="min-w-0 truncate">
                                {s.numeroCamiseta != null && <span className="text-ink-soft">#{s.numeroCamiseta} </span>}
                                {s.nombre}
                              </span>
                              <span className="shrink-0 text-xs font-medium text-brand">
                                {yaTienePedido ? 'Ya tiene un pedido' : 'Pedir cambio ›'}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    <button
                      onClick={() => handlePedirCambio(null)}
                      disabled={enviandoSolicitud}
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-sm font-medium text-ink-soft disabled:opacity-50"
                    >
                      Sacarlo sin reemplazo (jugar con uno menos)
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 p-4">
                <button
                  onClick={() => handleMoverDesdeCambio('suplente')}
                  className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                >
                  Pasa a Suplente
                </button>
                <button
                  onClick={() => handleMoverDesdeCambio('pool')}
                  className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft"
                >
                  Vuelve a Jugadores
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
