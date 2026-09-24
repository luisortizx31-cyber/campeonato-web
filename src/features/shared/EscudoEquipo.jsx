import { useState } from 'react'
import { colorEquipo, inicialEquipo } from '../../utils/colorEquipo'
import { VisorFoto } from './VisorFoto'

// Badge circular del equipo: su foto de portada si ya subio una (ver
// TabEquipos, torneoEquiposService.actualizarFotoPortadaEquipo), o la
// inicial coloreada por hash del nombre mientras tanto - se repite en
// varias pantallas (Fechas, Jugadores) para que un mismo equipo se
// identifique de un vistazo aunque el nombre este truncado o comparta
// prefijo con otro ("Promo 2000/2001/2002").
//
// Con foto, tocar el badge la abre en grande (VisorFoto) - stopPropagation
// porque en Jugadores este badge vive adentro de un <button> mas grande
// que abre la ficha de la promocion, y un span (no button, para poder
// anidarlo sin romper el HTML) con su propio click no debe disparar
// tambien el del padre.
//
// tamanoClase/textoClase permiten un escudo mas grande donde hay lugar
// (ej. el listado "Partidos") sin cambiar el tamaño por defecto (32px)
// de los demas usos.
export function EscudoEquipo({ nombre, fotoUrl, tamanoClase = 'h-8 w-8', textoClase = 'text-xs' }) {
  const color = colorEquipo(nombre)
  const [verGrande, setVerGrande] = useState(false)

  return (
    <>
      <span
        onClick={
          fotoUrl
            ? (e) => {
                e.stopPropagation()
                setVerGrande(true)
              }
            : undefined
        }
        className={`flex ${tamanoClase} shrink-0 items-center justify-center overflow-hidden rounded-full ${textoClase} font-bold ${color.bg} ${color.text} ${fotoUrl ? 'cursor-pointer' : ''}`}
      >
        {fotoUrl ? <img src={fotoUrl} alt="" className="h-full w-full object-cover" /> : inicialEquipo(nombre)}
      </span>
      {verGrande && fotoUrl && <VisorFoto url={fotoUrl} onCerrar={() => setVerGrande(false)} />}
    </>
  )
}
