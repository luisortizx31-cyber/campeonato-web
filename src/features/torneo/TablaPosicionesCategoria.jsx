import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../services/torneoEquiposService'
import { listarPartidosPorCategoria } from '../../services/torneoPartidosService'
import { listarAjustesPorCategoria } from '../../services/torneoAjustesService'
import { calcularTablaPosiciones } from '../../utils/tablaPosiciones'

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
 */
export default function TablaPosicionesCategoria({ torneoId, categoria, refreshKey, onFilas }) {
  const [filas, setFilas] = useState([])
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
        const [equipos, partidos, ajustes] = await Promise.all([
          listarEquiposPorCategoria(torneoId, categoria),
          listarPartidosPorCategoria(torneoId, categoria),
          // Coleccion nueva (ver ModalAjustarPuntos) - si su regla de
          // Firestore todavia no esta desplegada, que la tabla siga
          // funcionando igual (sin ajustes) en vez de romperse entera.
          listarAjustesPorCategoria(torneoId, categoria).catch((err) => {
            console.error('[TablaPosicionesCategoria] listarAjustesPorCategoria', err)
            return []
          }),
        ])
        if (!cancelado) {
          const nuevasFilas = calcularTablaPosiciones({ equipos, partidos, ajustes })
          setFilas(nuevasFilas)
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

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-soft">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Equipo</th>
            <th className="px-2 py-2 text-center font-medium">PJ</th>
            <th className="px-2 py-2 text-center font-medium">PG</th>
            <th className="px-2 py-2 text-center font-medium">PE</th>
            <th className="px-2 py-2 text-center font-medium">PP</th>
            <th className="px-2 py-2 text-center font-medium">GF</th>
            <th className="px-2 py-2 text-center font-medium">GC</th>
            <th className="px-2 py-2 text-center font-medium">DG</th>
            <th className="px-3 py-2 text-center font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.equipoId} className="border-b border-line last:border-0">
              <td className="px-3 py-2 text-ink-soft">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{f.nombre}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.pj}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.pg}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.pe}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.pp}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.gf}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.gc}</td>
              <td className="money px-2 py-2 text-center text-ink">{f.dg}</td>
              <td className="money px-3 py-2 text-center font-bold text-ink">
                {f.pts}
                {f.ajustePts !== 0 && (
                  <span className={`ml-1 font-normal ${f.ajustePts > 0 ? 'text-success' : 'text-danger'}`}>
                    ({f.ajustePts > 0 ? '+' : ''}{f.ajustePts})
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
