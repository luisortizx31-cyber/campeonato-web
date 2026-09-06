import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { listarJugadoresPorEquipo, eliminarJugador } from '../../../services/torneoJugadoresService'
import { obtenerEquipo, listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { suscribirPartidosPorCategoria } from '../../../services/torneoPartidosService'
import { obtenerConfigCategoria } from '../../../services/torneoConfigService'
import ModalInscribirJugadorDelegado from '../ModalInscribirJugadorDelegado'
import AlineacionPartidoDelegado from './AlineacionPartidoDelegado'

/**
 * Vista del delegado logueado desde la pagina publica (ver
 * PaginaPublicaTorneo) - acceso restringido a SU equipo nada mas (ver
 * firestore.rules): puede ver su plantel, inscribir jugadores nuevos,
 * y armar la alineacion de un partido puntual mientras el Maestro se
 * lo tenga habilitado (ver ControlPartido, boton "Habilitar
 * delegado").
 */
export default function TabMiEquipoDelegado() {
  const { perfil } = useAuth()
  const [equipo, setEquipo] = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [jugadoresPorEquipo, setJugadoresPorEquipo] = useState(11)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'nuevo' | jugador a editar
  const [partidoAbiertoId, setPartidoAbiertoId] = useState(null)
  const [subTab, setSubTab] = useState('jugadores')
  const [jugadoresAbierto, setJugadoresAbierto] = useState(true)
  const [inscripcionesCerradas, setInscripcionesCerradas] = useState(false)
  const [eliminando, setEliminando] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)

  async function cargarJugadores() {
    try {
      const js = await listarJugadoresPorEquipo(perfil.equipoId)
      setJugadores(js.filter((j) => !j.eliminado))
    } catch (err) {
      console.error('[TabMiEquipoDelegado] cargarJugadores', err)
    }
  }

  async function handleEliminar(jugador) {
    if (!confirm(`¿Eliminar a "${jugador.nombre}"?`)) return
    setEliminando(jugador.id)
    setErrorAccion(null)
    try {
      await eliminarJugador(jugador.id)
      await cargarJugadores()
    } catch (err) {
      console.error('[TabMiEquipoDelegado] handleEliminar', err)
      setErrorAccion(err.message || 'No se pudo eliminar el jugador.')
    } finally {
      setEliminando(null)
    }
  }

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)

    obtenerEquipo(perfil.equipoId)
      .then(async (eq) => {
        if (cancelado || !eq) return
        setEquipo(eq)
        const [js, eqs, cfg] = await Promise.all([
          listarJugadoresPorEquipo(perfil.equipoId),
          listarEquiposPorCategoria(perfil.torneoId, eq.categoria),
          obtenerConfigCategoria(perfil.torneoId, eq.categoria),
        ])
        if (cancelado) return
        setJugadores(js.filter((j) => !j.eliminado))
        setEquipos(eqs)
        setJugadoresPorEquipo(cfg.jugadoresPorEquipo)
        setInscripcionesCerradas(cfg.inscripcionesCerradas)
      })
      .catch((err) => {
        console.error('[TabMiEquipoDelegado]', err)
        if (!cancelado) setError('No se pudo cargar tu equipo.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.equipoId])

  // Los partidos se siguen en vivo para que la lista de "podés armar la
  // alineación" aparezca sola apenas el Maestro la habilita, sin tener
  // que refrescar la página - pero recien se suscribe una vez que se
  // sabe la categoria del equipo (necesita el equipo cargado primero).
  useEffect(() => {
    if (!equipo) return
    const desuscribir = suscribirPartidosPorCategoria(perfil.torneoId, equipo.categoria, (ps) => {
      setPartidos(ps.filter((p) => p.equipoLocalId === perfil.equipoId || p.equipoVisitanteId === perfil.equipoId))
    })
    return desuscribir
  }, [perfil.torneoId, perfil.equipoId, equipo])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  const partidosConAlineacionAbierta = partidos.filter((p) => {
    const esLocal = p.equipoLocalId === perfil.equipoId
    return esLocal ? p.alineacionAbiertaLocal : p.alineacionAbiertaVisitante
  })

  // La pestaña "Alineación" solo existe mientras el Maestro tenga
  // habilitado algún partido - si el delegado la tenía abierta y el
  // Maestro lo cierra (o ya la armó), esto vuelve sola a "Jugadores"
  // en vez de dejar una pestaña vacía seleccionada (derivado en el
  // render, no con un efecto, para no encadenar otro renderizado).
  const subTabEfectiva = subTab === 'alineacion' && partidosConAlineacionAbierta.length === 0 ? 'jugadores' : subTab

  const jugadoresOrdenados = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre))

  const partidoAbierto = partidoAbiertoId ? partidos.find((p) => p.id === partidoAbiertoId) : null

  if (partidoAbierto) {
    const equipoDelPartido = partidoAbierto.equipoLocalId === perfil.equipoId ? 'local' : 'visitante'
    const rivalId = equipoDelPartido === 'local' ? partidoAbierto.equipoVisitanteId : partidoAbierto.equipoLocalId
    return (
      <AlineacionPartidoDelegado
        torneoId={perfil.torneoId}
        categoria={equipo?.categoria}
        equipoId={perfil.equipoId}
        partido={partidoAbierto}
        equipo={equipoDelPartido}
        jugadores={jugadores}
        jugadoresPorEquipo={jugadoresPorEquipo}
        nombreRival={nombreEquipo(rivalId)}
        onVolver={() => setPartidoAbiertoId(null)}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3">
        <p className="truncate text-sm font-bold text-ink">
          👋 ¡Bienvenido, delegado de {equipo?.nombre || '…'}!
        </p>
        <p className="text-[11px] text-ink-soft">Podés inscribir jugadores y armar la alineación de tu equipo.</p>
      </div>

      <div className="mb-4 flex overflow-hidden rounded-xl border border-line">
        <button
          onClick={() => setSubTab('jugadores')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            subTabEfectiva === 'jugadores' ? 'bg-brand text-white' : 'bg-surface text-ink-soft'
          }`}
        >
          👥 Jugadores
        </button>
        {partidosConAlineacionAbierta.length > 0 && (
          <button
            onClick={() => setSubTab('alineacion')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              subTabEfectiva === 'alineacion' ? 'bg-success text-white' : 'bg-success-soft text-success'
            }`}
          >
            🔓 Arma tu equipo ({partidosConAlineacionAbierta.length})
          </button>
        )}
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {errorAccion && (
        <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorAccion}</p>
      )}

      {!cargando && !error && subTabEfectiva === 'jugadores' && (
        <>
          <div className="mb-4 overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              onClick={() => setJugadoresAbierto((v) => !v)}
              className="flex w-full items-center justify-between gap-2 bg-paper px-4 py-2.5 text-left"
            >
              <span className="text-xs font-bold tracking-wide text-ink-soft uppercase">
                Jugadores ({jugadoresOrdenados.length})
              </span>
              <span className={`text-ink-soft transition-transform ${jugadoresAbierto ? 'rotate-180' : ''}`}>
                ⌄
              </span>
            </button>
            {jugadoresAbierto && (
              <ul className="divide-y divide-line border-t border-line">
                {jugadoresOrdenados.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                      {j.numeroCamiseta ?? '–'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{j.nombre}</p>
                      {(j.esJale || j.suspendido) && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {j.esJale && (
                            <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning">
                              JALE
                            </span>
                          )}
                          {j.suspendido && (
                            <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger">
                              Suspendido
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!inscripcionesCerradas && (
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() => setModal(j)}
                          className="rounded-lg border border-line px-2.5 py-1 text-xs text-ink-soft"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminar(j)}
                          disabled={eliminando === j.id}
                          className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs text-danger disabled:opacity-50"
                        >
                          {eliminando === j.id ? '…' : 'Eliminar'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {jugadoresOrdenados.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-ink-soft">
                    Todavía no inscribiste jugadores.
                  </li>
                )}
              </ul>
            )}
          </div>

          {inscripcionesCerradas ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-3 text-center text-xs text-ink-soft">
              Las inscripciones están cerradas. Si querés inscribir más jugadores, hablá con el administrador del torneo.
            </p>
          ) : (
            <button
              onClick={() => setModal('nuevo')}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white"
            >
              + Inscribir jugador
            </button>
          )}
        </>
      )}

      {!cargando && !error && subTabEfectiva === 'alineacion' && (
        <ul className="space-y-2">
          {partidosConAlineacionAbierta.map((p) => {
            const esLocal = p.equipoLocalId === perfil.equipoId
            const rivalId = esLocal ? p.equipoVisitanteId : p.equipoLocalId
            return (
              <li key={p.id}>
                <button
                  onClick={() => setPartidoAbiertoId(p.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-left"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-success">
                    🔓 Fecha {p.fechaNumero} vs {nombreEquipo(rivalId)} — Armar alineación
                  </span>
                  <span className="shrink-0 text-success">›</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {modal && equipo && !inscripcionesCerradas && (
        <ModalInscribirJugadorDelegado
          torneoId={perfil.torneoId}
          categoria={equipo.categoria}
          equipoId={perfil.equipoId}
          jugadores={jugadores}
          jugador={modal === 'nuevo' ? null : modal}
          onCerrar={() => setModal(null)}
          onGuardado={async () => {
            setModal(null)
            await cargarJugadores()
          }}
        />
      )}
    </div>
  )
}
