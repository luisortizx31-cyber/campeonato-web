import { useEffect, useState } from 'react'
import { actualizarTitular, actualizarSuplente } from '../../../services/torneoPartidosService'
import { actualizarNumeroCamiseta } from '../../../services/torneoJugadoresService'

function porNombre(a, b) {
  return a.nombre.localeCompare(b.nombre)
}

// Input de numero de camiseta con estado local propio (igual que
// FilaAlineacion en ControlPartido) - asi cada tecla que se escribe no
// depende de un re-render del padre, y onBlur recien ahi dispara el
// guardado. Si el guardado falla (ej. numero repetido en el equipo, o
// el Maestro cerro las inscripciones), vuelve al valor anterior.
function InputCamiseta({ jugador, onGuardar }) {
  const [numero, setNumero] = useState(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')

  useEffect(() => {
    setNumero(jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : '')
  }, [jugador.numeroCamiseta])

  async function guardar() {
    const actual = jugador.numeroCamiseta != null ? String(jugador.numeroCamiseta) : ''
    if (numero.trim() === actual) return
    const ok = await onGuardar(jugador.id, numero.trim())
    if (!ok) setNumero(actual)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      value={numero}
      onChange={(e) => setNumero(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.target.blur()
      }}
      placeholder="#"
      title="Número de camiseta"
      className="no-spinner w-12 shrink-0 rounded-md border border-line bg-paper px-1 py-1.5 text-center text-sm font-medium text-ink outline-none focus-visible:border-brand"
    />
  )
}

/**
 * Selector de titulares/suplentes para el delegado (ver
 * TabMiEquipoDelegado) - version simplificada de SelectorAlineacion
 * (ControlPartido), sin el check de "trajo DNI hoy" (eso es una
 * verificacion del dia del partido en la cancha, no tiene sentido acá)
 * y sin la seccion de expulsados (eso es estado EN VIVO del partido,
 * el delegado arma esto de antemano). Solo funciona mientras el
 * Maestro tenga la alineacion abierta para este equipo (ver
 * ControlPartido y firestore.rules) - si la cierra en el medio, el
 * proximo intento de guardar simplemente falla con un error.
 */
export default function AlineacionPartidoDelegado({ partido, equipo, jugadores: jugadoresIniciales, jugadoresPorEquipo, nombreRival, onVolver }) {
  const [titulares, setTitulares] = useState(
    (equipo === 'local' ? partido.titularesLocal : partido.titularesVisitante) || []
  )
  const [suplentes, setSuplentes] = useState(
    (equipo === 'local' ? partido.suplentesLocal : partido.suplentesVisitante) || []
  )
  // Copia local (no la prop directo) para poder reflejar al toque un
  // numero de camiseta recien guardado - mismo motivo que
  // jugadoresLocal/Visitante en ControlPartido.
  const [jugadores, setJugadores] = useState(jugadoresIniciales)
  const [error, setError] = useState(null)

  async function mover(jugadorId, nuevoEstado) {
    const nuevosTitulares = nuevoEstado === 'titular' ? [...new Set([...titulares, jugadorId])] : titulares.filter((id) => id !== jugadorId)
    const nuevosSuplentes = nuevoEstado === 'suplente' ? [...new Set([...suplentes, jugadorId])] : suplentes.filter((id) => id !== jugadorId)
    setTitulares(nuevosTitulares)
    setSuplentes(nuevosSuplentes)
    setError(null)
    try {
      await Promise.all([
        actualizarTitular(partido.id, equipo, jugadorId, nuevoEstado === 'titular'),
        actualizarSuplente(partido.id, equipo, jugadorId, nuevoEstado === 'suplente'),
      ])
    } catch (err) {
      console.error('[AlineacionPartidoDelegado]', err)
      setError('No se pudo guardar - puede que el Maestro haya cerrado el acceso. Volvé a intentar o consultale.')
    }
  }

  // No puede repetirse un numero dentro del propio equipo - mismo
  // chequeo que ControlPartido, optimista con reversion si falla (ver
  // InputCamiseta).
  async function handleGuardarCamiseta(jugadorId, valor) {
    const numero = valor === '' ? null : Number(valor)
    if (numero != null) {
      const duplicado = jugadores.find((j) => j.id !== jugadorId && j.numeroCamiseta === numero)
      if (duplicado) {
        setError(`El número ${numero} ya lo tiene ${duplicado.nombre}.`)
        return false
      }
    }
    setError(null)
    setJugadores((js) => js.map((j) => (j.id === jugadorId ? { ...j, numeroCamiseta: numero } : j)))
    try {
      await actualizarNumeroCamiseta(jugadorId, numero)
      return true
    } catch (err) {
      console.error('[AlineacionPartidoDelegado] handleGuardarCamiseta', err)
      setError('No se pudo guardar el número de camiseta - puede que el Maestro haya cerrado las inscripciones.')
      return false
    }
  }

  const listaTitulares = jugadores.filter((j) => titulares.includes(j.id)).sort(porNombre)
  const listaSuplentes = jugadores.filter((j) => suplentes.includes(j.id)).sort(porNombre)
  const listaPool = jugadores.filter((j) => !titulares.includes(j.id) && !suplentes.includes(j.id)).sort(porNombre)
  const completo = titulares.length >= jugadoresPorEquipo

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={onVolver}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft"
        >
          ← Volver
        </button>
        <p className="truncate text-xs text-ink-soft">Fecha {partido.fechaNumero} vs {nombreRival}</p>
      </div>

      <p className="mb-3 text-sm text-ink-soft">
        Elegí quiénes juegan este partido. Titulares:{' '}
        <strong className={completo ? 'text-success' : 'text-ink'}>{titulares.length}/{jugadoresPorEquipo}</strong>
      </p>

      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        ● Titulares ({listaTitulares.length})
      </h2>
      <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {listaTitulares.map((j) => (
          <li key={j.id} className="flex items-center gap-2 px-3 py-2">
            <button onClick={() => mover(j.id, 'suplente')} className="min-w-0 flex-1 text-left text-sm text-ink">
              ● {j.nombre}
            </button>
            <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} />
          </li>
        ))}
        {listaTitulares.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-ink-soft">Sin titulares todavía</li>
        )}
      </ul>

      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        ○ Suplentes ({listaSuplentes.length})
      </h2>
      <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {listaSuplentes.map((j) => (
          <li key={j.id} className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => mover(j.id, 'titular')}
              disabled={completo}
              className="min-w-0 flex-1 text-left text-sm text-ink-soft disabled:opacity-50"
            >
              ○ {j.nombre}
            </button>
            <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} />
          </li>
        ))}
        {listaSuplentes.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-ink-soft">Sin suplentes todavía</li>
        )}
      </ul>

      <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
        ◌ Jugadores ({listaPool.length})
      </h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {listaPool.map((j) => (
          <li key={j.id} className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{j.nombre}</span>
            <InputCamiseta jugador={j} onGuardar={handleGuardarCamiseta} />
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => mover(j.id, 'titular')}
                disabled={completo}
                className="rounded-md border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success disabled:cursor-not-allowed disabled:opacity-40"
              >
                Titular
              </button>
              <button
                onClick={() => mover(j.id, 'suplente')}
                className="rounded-md border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft"
              >
                Suplente
              </button>
            </div>
          </li>
        ))}
        {listaPool.length === 0 && (
          <li className="px-3 py-3 text-center text-xs text-ink-soft">Ya asignaste a todo el plantel</li>
        )}
      </ul>
    </div>
  )
}
