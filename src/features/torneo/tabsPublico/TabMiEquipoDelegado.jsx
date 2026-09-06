import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { logout } from '../../../services/authService'
import { listarJugadoresPorEquipo } from '../../../services/torneoJugadoresService'
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
  const [modalNuevo, setModalNuevo] = useState(false)
  const [partidoAbiertoId, setPartidoAbiertoId] = useState(null)

  async function cargarJugadores() {
    try {
      const js = await listarJugadoresPorEquipo(perfil.equipoId)
      setJugadores(js.filter((j) => !j.eliminado))
    } catch (err) {
      console.error('[TabMiEquipoDelegado] cargarJugadores', err)
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

  const partidoAbierto = partidoAbiertoId ? partidos.find((p) => p.id === partidoAbiertoId) : null

  if (partidoAbierto) {
    const equipoDelPartido = partidoAbierto.equipoLocalId === perfil.equipoId ? 'local' : 'visitante'
    const rivalId = equipoDelPartido === 'local' ? partidoAbierto.equipoVisitanteId : partidoAbierto.equipoLocalId
    return (
      <AlineacionPartidoDelegado
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
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">
            👋 ¡Bienvenido, delegado de {equipo?.nombre || '…'}!
          </p>
          <p className="text-[11px] text-ink-soft">Podés inscribir jugadores y armar la alineación de tu equipo.</p>
        </div>
        <button
          onClick={() => logout()}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft"
        >
          Cerrar sesión
        </button>
      </div>

      {partidosConAlineacionAbierta.length > 0 && (
        <ul className="mb-4 space-y-2">
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

      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setModalNuevo(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          + Inscribir jugador
        </button>
      </div>

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!cargando && !error && (
        <ul className="space-y-2">
          {jugadores.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
            >
              <p className="min-w-0 truncate text-sm font-medium text-ink">
                {j.nombre} {j.numeroCamiseta && <span className="text-ink-soft">#{j.numeroCamiseta}</span>}
                {j.esJale && (
                  <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                    JALE
                  </span>
                )}
              </p>
              {j.suspendido && (
                <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                  Suspendido
                </span>
              )}
            </li>
          ))}
          {jugadores.length === 0 && (
            <li className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
              Todavía no inscribiste jugadores.
            </li>
          )}
        </ul>
      )}

      {modalNuevo && equipo && (
        <ModalInscribirJugadorDelegado
          torneoId={perfil.torneoId}
          categoria={equipo.categoria}
          equipoId={perfil.equipoId}
          jugadores={jugadores}
          onCerrar={() => setModalNuevo(false)}
          onGuardado={async () => {
            setModalNuevo(false)
            await cargarJugadores()
          }}
        />
      )}
    </div>
  )
}
