// Avatar circular de solo lectura: la foto del jugador si tiene, o su
// inicial mientras tanto - mismo criterio que el avatar admin
// (FilaJugadorAdmin) pero sin ningun control para cambiarla.
function AvatarJugadorPublica({ nombre, fotoUrl }) {
  const inicial = nombre?.trim()?.charAt(0)?.toUpperCase() || '—'
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper">
      {fotoUrl ? (
        <img src={fotoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-bold text-ink-soft">{inicial}</span>
      )}
    </span>
  )
}

export function EstadoJugador({ jugador }) {
  if (jugador.eliminado) {
    return (
      <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
        ❌ Eliminado
      </span>
    )
  }
  if (jugador.suspendido) {
    return (
      <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
        Suspendido
      </span>
    )
  }
  return null
}

// Fila de un jugador de solo lectura (ver TabJugadoresPublica,
// DetalleEquipoPublica) - nunca consulta la subcoleccion privada de
// DNI, ni la ofrece de ninguna forma.
export function FilaJugadorPublica({ jugador, nombreEquipo, className = '' }) {
  return (
    <li className={`flex items-center justify-between gap-2 px-4 py-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <AvatarJugadorPublica nombre={jugador.nombre} fotoUrl={jugador.fotoUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {jugador.nombre} {jugador.numeroCamiseta && <span className="text-ink-soft">#{jugador.numeroCamiseta}</span>}
            {jugador.esJale && (
              <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 align-middle text-[10px] font-bold text-warning">
                JALE
              </span>
            )}
          </p>
          {nombreEquipo && <p className="text-xs text-ink-soft">{nombreEquipo}</p>}
        </div>
      </div>
      <EstadoJugador jugador={jugador} />
    </li>
  )
}
