import { forwardRef, useEffect, useRef, useState } from 'react'
import { listarJugadoresPorCategoria } from '../../services/torneoJugadoresService'
import { listarEquiposPorCategoria } from '../../services/torneoEquiposService'
import { listarGolesPorCategoria } from '../../services/torneoGolesService'
import { calcularTablaGoleadores } from '../../utils/tablaGoleadores'

const ESTILO_PODIO = {
  1: { badge: 'bg-gold text-white', fila: 'bg-gold-soft/50' },
  2: { badge: 'bg-ink-soft text-white', fila: 'bg-paper' },
  3: { badge: 'bg-warning text-white', fila: 'bg-warning-soft/40' },
}

/**
 * Tabla de goleadores de una categoria: ranking de jugadores por
 * goles anotados, recalculada siempre desde /torneo_goles (nunca un
 * contador guardado). La usan tanto el panel admin como la pagina
 * publica, igual que TablaPosicionesCategoria.
 *
 * Expone su nodo raiz via `ref` para que el padre pueda capturarla
 * como imagen/PDF (ver BotonDescargarTabla).
 */
const TablaGoleadoresCategoria = forwardRef(function TablaGoleadoresCategoria(
  { torneoId, categoria, refreshKey, onFilas },
  ref
) {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const onFilasRef = useRef(onFilas)
  useEffect(() => {
    onFilasRef.current = onFilas
  }, [onFilas])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setCargando(true)
      setError(null)
      try {
        const [jugadores, equipos, goles] = await Promise.all([
          listarJugadoresPorCategoria(torneoId, categoria),
          listarEquiposPorCategoria(torneoId, categoria),
          // Coleccion nueva - si su regla de Firestore todavia no esta
          // desplegada, que la tabla siga funcionando igual (vacia) en
          // vez de romperse entera.
          listarGolesPorCategoria(torneoId, categoria).catch((err) => {
            console.error('[TablaGoleadoresCategoria] listarGolesPorCategoria', err)
            return []
          }),
        ])
        if (!cancelado) {
          const nombreEquipo = (id) => equipos.find((e) => e.id === id)?.nombre || '—'
          const nuevasFilas = calcularTablaGoleadores({ jugadores, goles }).map((f) => ({
            ...f,
            equipoNombre: nombreEquipo(f.equipoId),
          }))
          setFilas(nuevasFilas)
          onFilasRef.current?.(nuevasFilas)
        }
      } catch (err) {
        console.error('[TablaGoleadoresCategoria]', err)
        if (!cancelado) setError('No se pudo cargar la tabla de goleadores.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    cargar()
    return () => {
      cancelado = true
    }
  }, [torneoId, categoria, refreshKey])

  if (cargando) return <p className="text-sm text-ink-soft">Cargando…</p>
  if (error) return <p className="text-sm text-danger">{error}</p>
  if (filas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
        Todavía no hay goles registrados en esta categoría.
      </div>
    )
  }

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="bg-brand-dark text-[10px] uppercase tracking-wider text-white/70">
            <th className="w-10 px-2 py-2 text-left font-semibold text-white">#</th>
            <th className="px-2 py-2 text-left font-semibold text-white">Jugador</th>
            <th className="w-12 px-2 py-2 text-center font-semibold text-white">⚽</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const puesto = i + 1
            const podio = ESTILO_PODIO[puesto]
            return (
              <tr
                key={f.jugadorId}
                className={`border-b border-line last:border-0 transition-colors hover:bg-brand-soft/40 ${
                  podio ? podio.fila : i % 2 === 0 ? 'bg-surface' : 'bg-paper/60'
                }`}
              >
                <td className="px-2 py-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      podio ? podio.badge : 'bg-brand-soft text-brand'
                    }`}
                  >
                    {puesto}
                  </span>
                </td>
                <td className="min-w-0 px-2 py-1.5">
                  <p className="truncate text-sm font-semibold text-ink">{f.nombre}</p>
                  <p className="truncate text-[11px] text-ink-soft">{f.equipoNombre}</p>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <span className="money inline-flex min-w-[1.75rem] items-center justify-center rounded-md bg-brand px-1.5 py-0.5 text-xs font-bold text-white">
                    {f.goles}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

export default TablaGoleadoresCategoria
