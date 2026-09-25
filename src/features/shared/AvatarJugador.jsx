import { AvatarFoto } from './AvatarFoto'

// Foto de un jugador (se agranda al tocarla, ver AvatarFoto) o, si todavia
// no subio una, la inicial de su nombre. Para las listas de solo lectura
// (Amonestados, etc). `colorBg`/`colorText` (opcionales) pintan la inicial.
export function AvatarJugador({ jugador, tamanoClase = 'h-10 w-10', colorBg, colorText }) {
  return (
    <AvatarFoto
      fotoUrl={jugador?.fotoUrl}
      texto={jugador?.nombre?.trim()?.charAt(0)?.toUpperCase() || '—'}
      tamanoClase={tamanoClase}
      colorBg={colorBg}
      colorText={colorText}
    />
  )
}
