import { useEffect, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import { listarJugadoresPorCategoria } from '../../../services/torneoJugadoresService'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import { colorEquipo } from '../../../utils/colorEquipo'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { FilaJugadorPublica } from '../FilaJugadorPublica'
import DetalleEquipoPublica from '../DetalleEquipoPublica'

// Solo lectura: nunca consulta la subcoleccion privada de DNI, ni la
// ofrece de ninguna forma - esta vista es publica.
//
// Con muchos equipos, mostrar a todos los jugadores de una es una
// lista larguisima - por eso, sin busqueda, se agrupan por equipo en
// secciones (tocar una promocion lleva a su ficha, ver
// DetalleEquipoPublica). Al escribir algo en el buscador se pasa a una
// lista plana con coincidencias de cualquier equipo, para no obligar a
// entrar promocion por promocion.
export default function TabJugadoresPublica({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => categoriasActivas[0])
  const swipeCategoria = useSwipeHorizontal(categoriasActivas, categoria, setCategoria)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [equipoDetalle, setEquipoDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setBusqueda('')
    setEquipoDetalle(null)
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

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const jugadoresBuscados = busquedaNormalizada
    ? jugadores.filter((j) => j.nombre?.toLowerCase().includes(busquedaNormalizada))
    : []

  if (equipoDetalle) {
    return (
      <DetalleEquipoPublica
        equipo={equipoDetalle}
        onCerrar={() => setEquipoDetalle(null)}
      />
    )
  }

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
              <FilaJugadorPublica
                key={j.id}
                jugador={j}
                nombreEquipo={nombreEquipo(j.equipoId)}
                className="rounded-xl border border-line bg-surface"
              />
            ))}
          </ul>
        )
      )}

      {!cargando && jugadores.length > 0 && !busquedaNormalizada && (
        <ul className="space-y-2">
          {equipos.map((eq) => {
            const jugadoresEquipo = jugadores.filter((j) => j.equipoId === eq.id)
            const color = colorEquipo(eq.nombre)
            return (
              <li key={eq.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <button
                  onClick={() => setEquipoDetalle(eq)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left ${color.bg}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <EscudoEquipo nombre={eq.nombre} fotoUrl={eq.fotoPortadaUrl} />
                    <span className={`break-words font-bold leading-tight ${color.text}`}>{eq.nombre}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-soft">
                    {jugadoresEquipo.length} jugador{jugadoresEquipo.length === 1 ? '' : 'es'}
                    <span>›</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      </div>
    </div>
  )
}
