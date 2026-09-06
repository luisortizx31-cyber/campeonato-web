import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { logout } from '../../../services/authService'
import { listarJugadoresPorEquipo } from '../../../services/torneoJugadoresService'
import { obtenerEquipo } from '../../../services/torneoEquiposService'
import ModalInscribirJugadorDelegado from '../ModalInscribirJugadorDelegado'

/**
 * Vista del delegado logueado desde la pagina publica (ver
 * PaginaPublicaTorneo) - acceso restringido a SU equipo nada mas (ver
 * firestore.rules): puede ver su plantel e inscribir jugadores nuevos,
 * nada del resto del torneo.
 */
export default function TabMiEquipoDelegado() {
  const { perfil } = useAuth()
  const [equipo, setEquipo] = useState(null)
  const [jugadores, setJugadores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, js] = await Promise.all([
        obtenerEquipo(perfil.equipoId),
        listarJugadoresPorEquipo(perfil.equipoId),
      ])
      setEquipo(eq)
      setJugadores(js.filter((j) => !j.eliminado))
    } catch (err) {
      console.error('[TabMiEquipoDelegado]', err)
      setError('No se pudo cargar tu equipo.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil.equipoId])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand-soft px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Delegado de</p>
          <p className="truncate font-bold text-ink">{equipo?.nombre || '…'}</p>
        </div>
        <button
          onClick={() => logout()}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft"
        >
          Cerrar sesión
        </button>
      </div>

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
            await cargar()
          }}
        />
      )}
    </div>
  )
}
