import { colorEquipo, inicialEquipo } from '../../utils/colorEquipo'

// Badge circular del equipo: su foto de portada si ya subio una (ver
// TabEquipos, torneoEquiposService.actualizarFotoPortadaEquipo), o la
// inicial coloreada por hash del nombre mientras tanto - se repite en
// varias pantallas (Fechas, Jugadores) para que un mismo equipo se
// identifique de un vistazo aunque el nombre este truncado o comparta
// prefijo con otro ("Promo 2000/2001/2002").
export function EscudoEquipo({ nombre, fotoUrl }) {
  const color = colorEquipo(nombre)
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${color.bg} ${color.text}`}>
      {fotoUrl ? (
        <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        inicialEquipo(nombre)
      )}
    </span>
  )
}
