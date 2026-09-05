import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  obtenerConfigCategoria,
  actualizarUmbralAmarillas,
  actualizarUmbralRojas,
  actualizarJugadoresPorEquipo,
  actualizarEquiposEliminados,
  actualizarMinimoJugadoresCancha,
  actualizarDiferenciaWalkover,
  actualizarMaximoJugadoresInscritos,
} from '../../../services/torneoConfigService'
import {
  CATEGORIA_TORNEO,
  CATEGORIA_TORNEO_LABELS,
  OPCIONES_UMBRAL_AMARILLAS,
  OPCIONES_UMBRAL_ROJAS,
  OPCIONES_JUGADORES_POR_EQUIPO,
  OPCIONES_DIFERENCIA_WALKOVER,
  OPCIONES_MAXIMO_JUGADORES_INSCRITOS,
} from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { useAuth } from '../../../context/AuthContext'
import SeccionColegios from './SeccionColegios'

export default function TabConfiguracion({ torneoId }) {
  const { esSuperAdmin } = useAuth()
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [config, setConfig] = useState(null) // { umbralAmarillas, umbralRojas, jugadoresPorEquipo, equiposEliminados }
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, cfg] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        obtenerConfigCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setConfig(cfg)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo cargar la configuración.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, categoria])

  async function handleCambiarJugadoresPorEquipo(nuevaCantidad) {
    setConfig((c) => ({ ...c, jugadoresPorEquipo: Number(nuevaCantidad) }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarJugadoresPorEquipo(torneoId, categoria, nuevaCantidad)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar el formato del partido.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarMinimoJugadoresCancha(nuevoValor) {
    const valor = nuevoValor ? Number(nuevoValor) : null
    setConfig((c) => ({ ...c, minimoJugadoresCancha: valor }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarMinimoJugadoresCancha(torneoId, categoria, valor)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar el mínimo de jugadores en cancha.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarDiferenciaWalkover(nuevaDiferencia) {
    setConfig((c) => ({ ...c, diferenciaWalkover: Number(nuevaDiferencia) }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarDiferenciaWalkover(torneoId, categoria, nuevaDiferencia)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar la diferencia de walkover.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarMaximoJugadoresInscritos(nuevoValor) {
    const valor = nuevoValor ? Number(nuevoValor) : null
    setConfig((c) => ({ ...c, maximoJugadoresInscritos: valor }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarMaximoJugadoresInscritos(torneoId, categoria, valor)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar el máximo de jugadores inscritos.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarUmbralAmarillas(nuevoUmbral) {
    setConfig((c) => ({ ...c, umbralAmarillas: Number(nuevoUmbral) }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarUmbralAmarillas(torneoId, categoria, nuevoUmbral)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar el umbral de suspensión.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarUmbralRojas(nuevoUmbral) {
    const valor = nuevoUmbral ? Number(nuevoUmbral) : null
    setConfig((c) => ({ ...c, umbralRojas: valor }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarUmbralRojas(torneoId, categoria, valor)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar el umbral de eliminación.')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarEquiposEliminados(nuevaCantidad) {
    const cantidad = Number(nuevaCantidad) || 0
    setConfig((c) => ({ ...c, equiposEliminados: cantidad }))
    setGuardando(true)
    setError(null)
    try {
      await actualizarEquiposEliminados(torneoId, categoria, cantidad)
    } catch (err) {
      console.error('[TabConfiguracion]', err)
      setError('No se pudo guardar la cantidad de equipos eliminados.')
    } finally {
      setGuardando(false)
    }
  }

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

      <div {...swipeCategoria}>
        {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
        {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        {!cargando && (
          <>
            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="jugadores-por-equipo" className="text-sm text-ink-soft">
                Formato del partido
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="jugadores-por-equipo"
                  value={config?.jugadoresPorEquipo ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarJugadoresPorEquipo(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  {OPCIONES_JUGADORES_POR_EQUIPO.map((n) => (
                    <option key={n} value={n}>Fútbol {n}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="minimo-jugadores-cancha" className="text-sm text-ink-soft">
                Dar walkover al bajar de
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="minimo-jugadores-cancha"
                  value={config?.minimoJugadoresCancha ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarMinimoJugadoresCancha(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  <option value="">Nunca</option>
                  {Array.from({ length: (config?.jugadoresPorEquipo || 0) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-ink-soft">jugadores en cancha</span>
              </div>
            </div>

            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="diferencia-walkover" className="text-sm text-ink-soft">
                Marcador del walkover
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="diferencia-walkover"
                  value={config?.diferenciaWalkover ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarDiferenciaWalkover(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  {OPCIONES_DIFERENCIA_WALKOVER.map((n) => (
                    <option key={n} value={n}>{n}-0</option>
                  ))}
                </select>
              </div>
            </div>
            {config?.minimoJugadoresCancha != null && (
              <p className="mb-2.5 -mt-1 text-xs text-ink-soft">
                Si un equipo queda con menos de {config.minimoJugadoresCancha} jugadores en cancha (por
                expulsiones), Control de Partido va a avisar que se puede cerrar el partido {config.diferenciaWalkover}-0
                a favor del otro equipo.
              </p>
            )}

            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="umbral-amarillas" className="text-sm text-ink-soft">
                Suspender al llegar a
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="umbral-amarillas"
                  value={config?.umbralAmarillas ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarUmbralAmarillas(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  {OPCIONES_UMBRAL_AMARILLAS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-ink-soft">amarillas</span>
              </div>
            </div>

            <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="umbral-rojas" className="text-sm text-ink-soft">
                Eliminar del campeonato al
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="umbral-rojas"
                  value={config?.umbralRojas ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarUmbralRojas(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  <option value="">Nunca</option>
                  {OPCIONES_UMBRAL_ROJAS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-ink-soft">suspensiones por roja</span>
              </div>
            </div>

            {equipos.length > 0 && (
              <div className="mb-2.5 flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
                <label htmlFor="equipos-eliminados" className="text-sm text-ink-soft">
                  Equipos eliminados (últimos de la tabla)
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="equipos-eliminados"
                    value={config?.equiposEliminados ?? 0}
                    disabled={!config || guardando}
                    onChange={(e) => handleCambiarEquiposEliminados(e.target.value)}
                    className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                  >
                    {Array.from({ length: equipos.length + 1 }, (_, n) => n).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span className="text-sm text-ink-soft">de {equipos.length}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
              <label htmlFor="maximo-jugadores-inscritos" className="text-sm text-ink-soft">
                Máximo de jugadores inscritos
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="maximo-jugadores-inscritos"
                  value={config?.maximoJugadoresInscritos ?? ''}
                  disabled={!config || guardando}
                  onChange={(e) => handleCambiarMaximoJugadoresInscritos(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
                >
                  <option value="">Sin límite</option>
                  {OPCIONES_MAXIMO_JUGADORES_INSCRITOS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-sm text-ink-soft">por equipo</span>
              </div>
            </div>
          </>
        )}
      </div>

      {esSuperAdmin && <SeccionColegios />}
    </div>
  )
}
