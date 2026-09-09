import { useState } from 'react'
import { agregarPartidoManualLiguilla } from '../../services/torneoLiguillaService'

/**
 * Agrega un cruce de liguilla a mano, fuera del asistente automatico
 * (armar clasificados -> sortear/sembrar -> confirmar). Para cuando
 * el sorteo se hizo por fuera de la app (ej. con un bombo fisico) y
 * el Maestro solo quiere cargar el resultado del sorteo tal cual, o
 * para sumar un cruce que el asistente no contempla (desempate,
 * repechaje, 3er puesto).
 *
 * `opcionesRonda` viene solo en formato ELIMINACION (una por cada
 * ronda ya existente del cuadro, mas "Nueva ronda") - ahi el cruce
 * tiene que quedar asociado a una `rondaLiguilla` para que el cuadro
 * lo reconozca (ver liguillaTorneo.reconstruirBracket). En formato
 * GRUPO no hay ronda: el cruce simplemente suma a la tabla del grupo.
 */
export default function ModalAgregarCruceManual({ torneoId, categoria, equipos, opcionesRonda, onCerrar, onGuardado }) {
  const [equipoLocalId, setEquipoLocalId] = useState(equipos[0]?.id || '')
  const [equipoVisitanteId, setEquipoVisitanteId] = useState(equipos[1]?.id || '')
  const [idaYVuelta, setIdaYVuelta] = useState(false)
  const [rondaLiguilla, setRondaLiguilla] = useState(opcionesRonda?.[0]?.valor ?? null)
  const [jornada, setJornada] = useState(opcionesRonda?.[0]?.label ?? 'Liguilla')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function handleCambiarRonda(valorStr) {
    const opcion = opcionesRonda.find((o) => String(o.valor) === valorStr)
    setRondaLiguilla(opcion?.valor ?? null)
    setJornada(opcion?.label ?? '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (equipoLocalId === equipoVisitanteId) {
      setError('Elegí dos equipos distintos.')
      return
    }
    setEnviando(true)
    try {
      await agregarPartidoManualLiguilla({
        torneoId,
        categoria,
        equipoLocalId,
        equipoVisitanteId,
        idaYVuelta,
        rondaLiguilla,
        jornada: jornada.trim() || 'Liguilla',
      })
      onGuardado()
    } catch (err) {
      console.error('[ModalAgregarCruceManual]', err)
      setError(err.message || 'No se pudo agregar el cruce.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">Agregar cruce manual</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <p className="mb-4 text-xs text-ink-soft">
            Para cuando el sorteo se hizo por fuera de la app, o para sumar un cruce que el
            asistente automático no contempla (desempate, repechaje, 3er puesto).
          </p>

          {opcionesRonda ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink">Ronda</label>
              <select
                value={rondaLiguilla ?? ''}
                onChange={(e) => handleCambiarRonda(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              >
                {opcionesRonda.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-ink">Etiqueta (opcional)</label>
              <input
                type="text"
                value={jornada}
                onChange={(e) => setJornada(e.target.value)}
                placeholder="Liguilla"
                className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink">Local</label>
            <select
              value={equipoLocalId}
              onChange={(e) => setEquipoLocalId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink">Visitante</label>
            <select
              value={equipoVisitanteId}
              onChange={(e) => setEquipoVisitanteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nombre}
                </option>
              ))}
            </select>
          </div>

          <label className="mb-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={idaYVuelta}
              onChange={(e) => setIdaYVuelta(e.target.checked)}
            />
            Ida y vuelta
          </label>

          {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Agregando…' : 'Agregar cruce'}
          </button>
        </form>
      </div>
    </div>
  )
}
