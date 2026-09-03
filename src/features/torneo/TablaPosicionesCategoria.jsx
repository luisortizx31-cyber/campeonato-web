import { forwardRef, useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../services/torneoPartidosService'
import { listarAjustesPorCategoria } from '../../services/torneoAjustesService'
import { obtenerConfigCategoria } from '../../services/torneoConfigService'
import { calcularTablaPosiciones } from '../../utils/tablaPosiciones'

const ESTILO_PODIO = {
  1: { badge: 'bg-gold text-white', fila: 'bg-gold-soft/50' },
  2: { badge: 'bg-ink-soft text-white', fila: 'bg-paper' },
  3: { badge: 'bg-warning text-white', fila: 'bg-warning-soft/40' },
}

/**
 * Tabla de posiciones de una categoria. La usan tanto el panel de
 * admin como la pagina publica, para que nunca puedan mostrar numeros
 * distintos - siempre se recalcula desde los partidos cargados, nunca
 * se guarda un contador.
 *
 * `refreshKey` (opcional): cambiar su valor fuerza un recalculo, para
 * que el admin vea la tabla actualizada apenas registra un resultado.
 *
 * `onFilas` (opcional): recibe las filas ya calculadas, para que el
 * padre pueda reusarlas (ej. exportar a Excel) sin volver a
 * consultar Firestore por su cuenta.
 *
 * Expone su nodo raiz via `ref` para que el padre pueda capturarla
 * como imagen/PDF (ver BotonDescargarTabla) sin que este componente
 * sepa nada de esa funcionalidad.
 */
const TablaPosicionesCategoria = forwardRef(function TablaPosicionesCategoria(
  { torneoId, categoria, refreshKey, onFilas },
  ref
) {
  const [filas, setFilas] = useState([])
  const [equiposEliminados, setEquiposEliminados] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  // Ref para no re-disparar el efecto de carga cada vez que el padre
  // pasa un onFilas con nueva identidad (ej. un arrow function
  // inline) - se actualiza en su propio efecto, nunca durante el
  // render.
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
        const [equipos, partidos, ajustes, config] = await Promise.all([
          listarEquiposPorCategoria(torneoId, categoria),
          listarPartidosPorCategoria(torneoId, categoria),
          // Coleccion nueva (ver ModalAjustarPuntos) - si su regla de
          // Firestore todavia no esta desplegada, que la tabla siga
          // funcionando igual (sin ajustes) en vez de romperse entera.
          listarAjustesPorCategoria(torneoId, categoria).catch((err) => {
            console.error('[TablaPosicionesCategoria] listarAjustesPorCategoria', err)
            return []
          }),
          obtenerConfigCategoria(torneoId, categoria).catch((err) => {
            console.error('[TablaPosicionesCategoria] obtenerConfigCategoria', err)
            return { equiposEliminados: 0 }
          }),
        ])
        if (!cancelado) {
          const nuevasFilas = calcularTablaPosiciones({ equipos, partidos, ajustes })
          setFilas(nuevasFilas)
          setEquiposEliminados(config.equiposEliminados || 0)
          onFilasRef.current?.(nuevasFilas)
        }
      } catch (err) {
        console.error('[TablaPosicionesCategoria]', err)
        if (!cancelado) setError('No se pudo cargar la tabla de posiciones.')
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
        Todavia no hay equipos en esta categoria.
      </div>
    )
  }

  // Puesto a partir del cual un equipo queda eliminado (los ultimos
  // `equiposEliminados` de la tabla) - null si no hay corte configurado
  // (ver TabPosiciones.jsx / torneoConfigService.actualizarEquiposEliminados).
  const corte =
    equiposEliminados > 0 ? Math.max(0, filas.length - equiposEliminados) : null

  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <table className="w-full table-fixed text-xs">
        <thead>
          <tr className="bg-brand-dark text-[9px] uppercase tracking-wider text-white/70">
            <th className="w-7 px-1 py-2 text-left font-semibold text-white">#</th>
            <th className="px-1.5 py-2 text-left font-semibold text-white">Equipo</th>
            <th className="w-10 px-1 py-2 text-center font-semibold text-white">Pts</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">PJ</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">PG</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">PE</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">PP</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">GF</th>
            <th className="w-6 px-0.5 py-2 text-center font-medium">GC</th>
            <th className="w-8 px-1 py-2 text-center font-medium">DG</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const puesto = i + 1
            const podio = ESTILO_PODIO[puesto]
            const eliminado = corte != null && puesto > corte
            const esPrimerEliminado = corte != null && puesto === corte + 1
            return (
              <tr
                key={f.equipoId}
                className={`border-b border-line last:border-0 transition-colors hover:bg-brand-soft/40 ${
                  esPrimerEliminado ? 'border-t-2 border-t-danger' : ''
                } ${
                  podio
                    ? podio.fila
                    : eliminado
                      ? 'bg-danger-soft/40'
                      : i % 2 === 0
                        ? 'bg-surface'
                        : 'bg-paper/60'
                }`}
              >
                <td className="px-1 py-1.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      podio
                        ? podio.badge
                        : eliminado
                          ? 'bg-danger-soft text-danger'
                          : 'bg-brand-soft text-brand'
                    }`}
                  >
                    {puesto}
                  </span>
                </td>
                <td className="truncate px-1.5 py-1.5 text-sm font-semibold text-ink">{f.nombre}</td>
                <td className="px-1 py-1.5 text-center">
                  <span className="money inline-flex min-w-[1.5rem] items-center justify-center rounded-md bg-brand px-1 py-0.5 text-xs font-bold text-white">
                    {f.pts}
                  </span>
                  {f.ajustePts !== 0 && (
                    <span className={`block text-[9px] font-medium ${f.ajustePts > 0 ? 'text-success' : 'text-danger'}`}>
                      ({f.ajustePts > 0 ? '+' : ''}{f.ajustePts})
                    </span>
                  )}
                </td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.pj}</td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.pg}</td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.pe}</td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.pp}</td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.gf}</td>
                <td className="money px-0.5 py-1.5 text-center text-[11px] text-ink-soft">{f.gc}</td>
                <td
                  className={`money px-1 py-1.5 text-center text-[11px] font-semibold ${
                    f.dg > 0 ? 'text-success' : f.dg < 0 ? 'text-danger' : 'text-ink-soft'
                  }`}
                >
                  {f.dg > 0 ? `+${f.dg}` : f.dg}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {corte != null && corte < filas.length && (
        <div className="flex items-center gap-2 border-t border-line bg-danger-soft/40 px-3 py-1.5 text-[11px] font-medium text-danger">
          <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
          Zona de eliminación: últimos {equiposEliminados} equipo{equiposEliminados === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
})

export default TablaPosicionesCategoria
