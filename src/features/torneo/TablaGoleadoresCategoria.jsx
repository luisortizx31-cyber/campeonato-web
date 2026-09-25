import { forwardRef, useEffect, useRef, useState } from 'react'
import { listarJugadoresPorCategoria } from '../../services/torneoJugadoresService'
import { listarEquiposPorCategoria } from '../../services/torneoEquiposService'
import { listarGolesPorCategoria } from '../../services/torneoGolesService'
import { calcularTablaGoleadores } from '../../utils/tablaGoleadores'
import { AvatarFoto } from '../shared/AvatarFoto'

// El 1er puesto no va en la tabla: tiene su propia tarjeta grande (ver
// TarjetaGoleador), asi que aca solo hace falta el estilo del 2do y 3ro.
const ESTILO_PODIO = {
  2: { badge: 'bg-ink-soft text-white', fila: 'bg-paper' },
  3: { badge: 'bg-warning text-white', fila: 'bg-warning-soft/40' },
}

function inicialDe(nombre) {
  return nombre?.trim()?.charAt(0)?.toUpperCase() || '—'
}

// El goleador del campeonato (1er puesto), en grande y con foto: tarjeta
// dorada con su foto en un aro blanco, el nombre, la promocion y los goles
// bien visibles. La foto se agranda al tocarla (ver AvatarFoto).
function TarjetaGoleador({ fila }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#b8861f] via-gold to-[#6b4e10] p-4 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10" />
      <p className="relative mb-3 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/90">
        <span aria-hidden="true">🏆</span> Goleador
      </p>
      <div className="relative flex items-center gap-4">
        {/* data-sin-captura: la foto no sale en la imagen/PDF descargado
            (ver BotonDescargarTabla), la tarjeta queda igual sin ella. */}
        <div data-sin-captura="true" className="shrink-0 rounded-full shadow-lg ring-4 ring-white/90">
          <AvatarFoto
            fotoUrl={fila.fotoUrl}
            texto={inicialDe(fila.nombre)}
            tamanoClase="h-24 w-24"
            colorBg="bg-white/90"
            colorText="text-[#7a5a14]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-xl font-extrabold leading-tight drop-shadow-sm">{fila.nombre}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-white/85">{fila.equipoNombre}</p>
        </div>
        <div className="shrink-0 text-center">
          <p className="money text-5xl font-black leading-none drop-shadow">{fila.goles}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/85">
            {fila.goles === 1 ? 'gol' : 'goles'}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Tabla de goleadores de una categoria: ranking de jugadores por
 * goles anotados, recalculada siempre desde /torneo_goles (nunca un
 * contador guardado). La usan tanto el panel admin como la pagina
 * publica, igual que TablaPosicionesCategoria.
 *
 * El goleador (1er puesto) se muestra aparte en una tarjeta grande y
 * dorada con su foto; del 2do puesto en adelante van en la tabla, cada
 * uno con su fotito (que tambien se agranda al tocarla). Las fotos no
 * salen en la imagen/PDF descargado (data-sin-captura).
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

  const [primero, ...resto] = filas

  return (
    <div ref={ref} className="space-y-3">
      <TarjetaGoleador fila={primero} />

      {resto.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="bg-brand-dark text-[10px] uppercase tracking-wider text-white/70">
                <th className="w-10 px-2 py-2 text-left font-semibold text-white">#</th>
                <th className="px-2 py-2 text-left font-semibold text-white">Jugador</th>
                <th className="w-12 px-2 py-2 text-center font-semibold text-white">⚽</th>
              </tr>
            </thead>
            <tbody>
              {resto.map((f, i) => {
                const puesto = i + 2
                const podio = ESTILO_PODIO[puesto]
                return (
                  <tr
                    key={f.jugadorId}
                    className={`border-b border-line last:border-0 transition-colors hover:bg-brand-soft/40 ${
                      podio ? podio.fila : i % 2 === 0 ? 'bg-paper/60' : 'bg-surface'
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
                      <div className="flex items-center gap-2">
                        <div data-sin-captura="true" className="shrink-0">
                          <AvatarFoto fotoUrl={f.fotoUrl} texto={inicialDe(f.nombre)} tamanoClase="h-9 w-9" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{f.nombre}</p>
                          <p className="truncate text-[11px] text-ink-soft">{f.equipoNombre}</p>
                        </div>
                      </div>
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
      )}
    </div>
  )
})

export default TablaGoleadoresCategoria
