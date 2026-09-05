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

// Agrupa varios ajustes relacionados bajo un mismo titulo (una sola
// tarjeta con separadores adentro) en vez de una fila suelta con su
// propio borde por cada ajuste - mismo dato, mucho mas facil de
// escanear de un vistazo.
function SeccionConfig({ icono, titulo, children }) {
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-line bg-surface">
      <p className="border-b border-line bg-ink-soft/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {icono} {titulo}
      </p>
      <div className="divide-y divide-line">{children}</div>
    </div>
  )
}

function FilaConfig({ htmlFor, label, children }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      <label htmlFor={htmlFor} className="text-sm text-ink-soft">
        {label}
      </label>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export default function TabConfiguracion({ torneoId }) {
  const { esSuperAdmin } = useAuth()
  const [categoria, setCategoria] = useState(CATEGORIA_TORNEO.MASTER)
  const swipeCategoria = useSwipeHorizontal(Object.values(CATEGORIA_TORNEO), categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [config, setConfig] = useState(null) // { umbralAmarillas, umbralRojas, jugadoresPorEquipo, equiposEliminados, minimoJugadoresCancha, diferenciaWalkover, maximoJugadoresInscritos }
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
            <SeccionConfig icono="⚽" titulo="Formato del partido">
              <FilaConfig htmlFor="jugadores-por-equipo" label="Jugadores por equipo">
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
              </FilaConfig>

              <FilaConfig htmlFor="minimo-jugadores-cancha" label="Dar walkover al bajar de">
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
                <span className="text-sm text-ink-soft">jug. en cancha</span>
              </FilaConfig>

              <FilaConfig htmlFor="diferencia-walkover" label="Marcador del walkover">
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
              </FilaConfig>

              {config?.minimoJugadoresCancha != null && (
                <p className="px-4 py-2.5 text-xs text-ink-soft">
                  Si un equipo queda con menos de {config.minimoJugadoresCancha} jugadores en cancha
                  (por expulsiones), Control de Partido va a avisar que se puede cerrar el partido{' '}
                  {config.diferenciaWalkover}-0 a favor del otro equipo.
                </p>
              )}
            </SeccionConfig>

            <SeccionConfig icono="🟨" titulo="Tarjetas y disciplina">
              <FilaConfig htmlFor="umbral-amarillas" label="Suspender al llegar a">
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
              </FilaConfig>

              <FilaConfig htmlFor="umbral-rojas" label="Eliminar del campeonato al">
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
              </FilaConfig>
            </SeccionConfig>

            <SeccionConfig icono="👥" titulo="Plantel">
              <FilaConfig htmlFor="maximo-jugadores-inscritos" label="Máximo de jugadores inscritos">
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
              </FilaConfig>
            </SeccionConfig>

            {equipos.length > 0 && (
              <SeccionConfig icono="📊" titulo="Tabla de posiciones">
                <FilaConfig htmlFor="equipos-eliminados" label="Equipos eliminados (últimos de la tabla)">
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
                </FilaConfig>
              </SeccionConfig>
            )}
          </>
        )}
      </div>

      {esSuperAdmin && <SeccionColegios />}
    </div>
  )
}
