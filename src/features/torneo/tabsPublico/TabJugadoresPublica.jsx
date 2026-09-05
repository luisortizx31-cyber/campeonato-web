import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { colorEquipo } from '../../../utils/colorEquipo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'

function EstadoJugador({ jugador }) {
  if (jugador.eliminado) {
    return (
      <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
        ❌ Eliminado
      </span>
    )
  }
  if (jugador.suspendido) {
    return (
      <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
        Suspendido
      </span>
    )
  }
  return null
}

// Solo lectura: nunca consulta la subcoleccion privada de DNI, ni la
// ofrece de ninguna forma - esta vista es publica.
//
// Con muchos equipos, mostrar a todos los jugadores de una es una
// lista larguisima - por eso, sin busqueda, se agrupan por equipo en
// secciones plegables (cerradas de entrada). Al escribir algo en el
// buscador se pasa a una lista plana con coincidencias de cualquier
// equipo, para no obligar a abrir seccion por seccion.
export default function TabJugadoresPublica({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [expandidos, setExpandidos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setBusqueda('')
    setExpandidos([])
    setCargando(true)
    Promise.all([listarEquiposPorCategoria(torneoId, categoria), listarJugadoresPorCategoria(torneoId, categoria)])
      .then(([eq, js]) => {
        if (cancelado) return
        setEquipos(eq)
        setJugadores(js)
      })
      .catch((err) => console.error('[TabJugadoresPublica]', err))
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria])

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  function toggleExpandido(equipoId) {
    setExpandidos((e) => (e.includes(equipoId) ? e.filter((id) => id !== equipoId) : [...e, equipoId]))
  }

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const jugadoresBuscados = busquedaNormalizada
    ? jugadores.filter((j) => j.nombre?.toLowerCase().includes(busquedaNormalizada))
    : []

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      <div {...swipeCategoria}>
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar jugador por nombre…"
        className="mb-4 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
      />

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}

      {!cargando && jugadores.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          Todavía no hay jugadores registrados.
        </div>
      )}

      {!cargando && jugadores.length > 0 && busquedaNormalizada && (
        jugadoresBuscados.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay ningún jugador que coincida con "{busqueda}".</p>
        ) : (
          <ul className="space-y-2">
            {jugadoresBuscados.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {j.nombre} {j.numeroCamiseta && <span className="text-ink-soft">#{j.numeroCamiseta}</span>}
                    {j.esJale && (
                      <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                        JALE
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">{nombreEquipo(j.equipoId)}</p>
                </div>
                <EstadoJugador jugador={j} />
              </li>
            ))}
          </ul>
        )
      )}

      {!cargando && jugadores.length > 0 && !busquedaNormalizada && (
        <ul className="space-y-2">
          {equipos.map((eq) => {
            const jugadoresEquipo = jugadores.filter((j) => j.equipoId === eq.id)
            const abierto = expandidos.includes(eq.id)
            const color = colorEquipo(eq.nombre)
            return (
              <li key={eq.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <button
                  onClick={() => toggleExpandido(eq.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${color.bg}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <EscudoEquipo nombre={eq.nombre} />
                    <span className={`truncate font-bold ${color.text}`}>{eq.nombre}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                    {jugadoresEquipo.length} jugador{jugadoresEquipo.length === 1 ? '' : 'es'}
                    <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>⌄</span>
                  </span>
                </button>
                {abierto && (
                  <ul className="divide-y divide-line border-t border-line bg-paper">
                    {jugadoresEquipo.length === 0 ? (
                      <li className="px-4 py-3 text-center text-xs text-ink-soft">Sin jugadores todavía.</li>
                    ) : (
                      jugadoresEquipo.map((j) => (
                        <li key={j.id} className="flex items-center justify-between gap-2 px-4 py-3">
                          <p className="truncate text-sm font-medium text-ink">
                            {j.nombre} {j.numeroCamiseta && <span className="text-ink-soft">#{j.numeroCamiseta}</span>}
                            {j.esJale && (
                              <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                                JALE
                              </span>
                            )}
                          </p>
                          <EstadoJugador jugador={j} />
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
      </div>
    </div>
  )
}
