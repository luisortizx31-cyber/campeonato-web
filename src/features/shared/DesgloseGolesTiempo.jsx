import { desgloseGolesPorTiempo } from '../../utils/golesPorTiempo'

// Debajo del nombre de un goleador del partido: en que tiempo hizo cada
// gol ("1er tiempo ⚽2", "2do tiempo ⚽1"...). `goles` son solo los goles
// de ese jugador. No muestra nada si ninguno quedo marcado con su tiempo
// (goles cargados sin cronometro en marcha).
export function DesgloseGolesTiempo({ goles }) {
  const filas = desgloseGolesPorTiempo(goles)
  if (filas.length === 0) return null
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {filas.map(({ etiqueta, cantidad }) => (
        <span
          key={etiqueta}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            etiqueta === 'Sin tiempo' ? 'bg-paper text-ink-soft' : 'bg-brand-soft text-brand'
          }`}
        >
          {etiqueta} ⚽{cantidad}
        </span>
      ))}
    </div>
  )
}
