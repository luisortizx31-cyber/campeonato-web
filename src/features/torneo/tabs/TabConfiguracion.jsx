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
  actualizarCategoriasActivas,
} from '../../../services/torneoConfigService'
import {
  CATEGORIA_TORNEO_LABELS,
  CATEGORIAS_TORNEO_DISPONIBLES,
  OPCIONES_UMBRAL_AMARILLAS,
  OPCIONES_UMBRAL_ROJAS,
  OPCIONES_JUGADORES_POR_EQUIPO,
  OPCIONES_DIFERENCIA_WALKOVER,
  OPCIONES_MAXIMO_JUGADORES_INSCRITOS,
} from '../../../models/torneo'
import { listarDelegados, alternarDelegado } from '../../../services/delegadosService'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { useAuth } from '../../../context/AuthContext'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import ModalCrearDelegado from '../ModalCrearDelegado'
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

export default function TabConfiguracion({ torneoId, categoriasActivas, onCategoriasActualizadas }) {
  const { esSuperAdmin } = useAuth()
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [config, setConfig] = useState(null) // { umbralAmarillas, umbralRojas, jugadoresPorEquipo, equiposEliminados, minimoJugadoresCancha, diferenciaWalkover, maximoJugadoresInscritos }
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [guardandoCategorias, setGuardandoCategorias] = useState(false)
  const [errorCategorias, setErrorCategorias] = useState(null)
  const [delegados, setDelegados] = useState([])
  const [modalDelegado, setModalDelegado] = useState(false)
  const [procesandoDelegado, setProcesandoDelegado] = useState(null)
  const [errorDelegados, setErrorDelegados] = useState(null)

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

  // Los delegados son del torneo entero (no por categoria) - se cargan
  // una sola vez aparte, no cada vez que se cambia de categoria.
  async function cargarDelegados() {
    try {
      setDelegados(await listarDelegados(torneoId))
    } catch (err) {
      console.error('[TabConfiguracion] listarDelegados', err)
    }
  }

  useEffect(() => {
    cargarDelegados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId])

  async function handleAlternarDelegado(delegado) {
    const accion = delegado.deshabilitado ? 'habilitar' : 'deshabilitar'
    if (!confirm(`¿${accion === 'habilitar' ? 'Habilitar' : 'Deshabilitar'} el acceso de ${delegado.nombreDelegado || delegado.email}?`)) return
    setProcesandoDelegado(delegado.id)
    setErrorDelegados(null)
    try {
      await alternarDelegado(delegado.id, !delegado.deshabilitado)
      await cargarDelegados()
    } catch (err) {
      console.error('[TabConfiguracion] alternarDelegado', err)
      setErrorDelegados(err.message || `No se pudo ${accion} el delegado.`)
    } finally {
      setProcesandoDelegado(null)
    }
  }

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

  // Nunca se puede dejar la lista de categorias activas vacia - el
  // checkbox de la ultima activa queda deshabilitado (ver JSX). No hay
  // aviso de confirmacion al desmarcar una categoria con datos: nada
  // se borra, solo deja de ofrecerse en los selectores hasta que se
  // vuelva a marcar.
  async function handleToggleCategoria(c) {
    const yaActiva = categoriasActivas.includes(c)
    if (yaActiva && categoriasActivas.length === 1) return
    const nuevaLista = yaActiva
      ? categoriasActivas.filter((x) => x !== c)
      : CATEGORIAS_TORNEO_DISPONIBLES.filter((x) => x === c || categoriasActivas.includes(x))
    setGuardandoCategorias(true)
    setErrorCategorias(null)
    try {
      await actualizarCategoriasActivas(torneoId, nuevaLista)
      onCategoriasActualizadas?.(nuevaLista)
    } catch (err) {
      console.error('[TabConfiguracion] actualizarCategoriasActivas', err)
      setErrorCategorias(err.message || 'No se pudo guardar la selección de categorías.')
    } finally {
      setGuardandoCategorias(false)
    }
  }

  // Solo los delegados de un equipo de la categoria que se esta
  // viendo ahora - mismo criterio que la seccion "Tabla de posiciones"
  // de arriba, que tambien depende de `equipos` (ya scopeado a esta
  // categoria).
  const delegadosDeCategoria = delegados.filter((d) => equipos.some((eq) => eq.id === d.equipoId))

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

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

              <FilaConfig htmlFor="minimo-jugadores-cancha" label="Dar walkover con menos de">
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

            <SeccionConfig icono="👤" titulo="Delegados de equipo">
              <div className="p-4">
                <button
                  type="button"
                  onClick={() => setModalDelegado(true)}
                  disabled={equipos.length === 0}
                  className="w-full rounded-lg border border-line py-2 text-sm font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                >
                  + Nuevo delegado
                </button>
              </div>

              {errorDelegados && (
                <p className="px-4 pb-2 text-xs text-danger">{errorDelegados}</p>
              )}

              {delegadosDeCategoria.length === 0 ? (
                <p className="px-4 pb-4 text-xs text-ink-soft">
                  Todavía no hay delegados en esta categoría. Un delegado solo puede inscribir
                  jugadores y ver la alineación de su propio equipo, desde el link público del
                  torneo.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {delegadosDeCategoria.map((d) => (
                    <li key={d.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {d.nombreDelegado || 'Sin nombre'}
                            {d.deshabilitado && (
                              <span className="ml-1.5 rounded-full bg-danger-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-danger">
                                DESHABILITADO
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-ink-soft">{d.equipoNombre}</p>
                          <p className="mt-1 font-mono text-xs text-ink-soft">
                            {d.email} · {d.password}
                          </p>
                        </div>
                        <button
                          onClick={() => handleAlternarDelegado(d)}
                          disabled={procesandoDelegado === d.id}
                          className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs disabled:opacity-50 ${
                            d.deshabilitado
                              ? 'border-success/30 text-success'
                              : 'border-danger/30 text-danger'
                          }`}
                        >
                          {procesandoDelegado === d.id ? '…' : d.deshabilitado ? 'Habilitar' : 'Deshabilitar'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SeccionConfig>
          </>
        )}
      </div>

      <SeccionConfig icono="🏷️" titulo="Categorías del campeonato">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {CATEGORIAS_TORNEO_DISPONIBLES.map((c) => {
            const activa = categoriasActivas.includes(c)
            const esUltimaActiva = activa && categoriasActivas.length === 1
            return (
              <label
                key={c}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  activa ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-soft'
                } ${esUltimaActiva || guardandoCategorias ? 'opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={activa}
                  disabled={esUltimaActiva || guardandoCategorias}
                  onChange={() => handleToggleCategoria(c)}
                  className="accent-brand"
                />
                {CATEGORIA_TORNEO_LABELS[c]}
              </label>
            )
          })}
        </div>
        {errorCategorias && (
          <p className="px-4 py-2.5 text-xs text-danger">{errorCategorias}</p>
        )}
        <p className="px-4 py-2.5 text-xs text-ink-soft">
          Solo las categorías marcadas acá aparecen para elegir en el resto del panel y en la página
          pública. Debe quedar al menos una activa.
        </p>
      </SeccionConfig>

      {esSuperAdmin && <SeccionColegios />}

      {modalDelegado && (
        <ModalCrearDelegado
          torneoId={torneoId}
          equipos={equipos}
          onCerrar={() => setModalDelegado(false)}
          onGuardado={async () => {
            setModalDelegado(false)
            await cargarDelegados()
          }}
        />
      )}
    </div>
  )
}
