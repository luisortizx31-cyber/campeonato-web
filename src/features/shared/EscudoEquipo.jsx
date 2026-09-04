import { colorEquipo, inicialEquipo } from '../../utils/colorEquipo'

// Badge circular con la inicial del equipo, coloreado por hash del
// nombre (ver utils/colorEquipo) - se repite en varias pantallas
// (Fechas, Jugadores) para que un mismo equipo se identifique de un
// vistazo aunque el nombre este truncado o comparta prefijo con otro
// ("Promo 2000/2001/2002").
export function EscudoEquipo({ nombre }) {
  const color = colorEquipo(nombre)
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
      {inicialEquipo(nombre)}
    </span>
  )
}
