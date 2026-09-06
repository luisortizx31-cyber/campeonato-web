import { useState } from 'react'
import { registrarJugador } from '../../services/torneoJugadoresService'

/**
 * Version simplificada de ModalRegistrarJugador para el delegado (ver
 * TabMiEquipoDelegado): sin selector de equipo (siempre el suyo, fijo)
 * ni DNI/telefono/verificacion RENIEC - eso queda para el Maestro
 * desde el panel admin. Solo nombre, camiseta y "jale".
 */
export default function ModalInscribirJugadorDelegado({ torneoId, categoria, equipoId, jugadores, onCerrar, onGuardado }) {
  const [form, setForm] = useState({ nombre: '', numeroCamiseta: '', esJale: false })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (form.numeroCamiseta) {
      const numero = Number(form.numeroCamiseta)
      const duplicado = jugadores.find((j) => j.numeroCamiseta === numero)
      if (duplicado) {
        setError(`El número ${numero} ya lo tiene ${duplicado.nombre}.`)
        return
      }
    }

    setEnviando(true)
    try {
      await registrarJugador({
        torneoId,
        categoria,
        equipoId,
        nombre: form.nombre,
        numeroCamiseta: form.numeroCamiseta,
        esJale: form.esJale,
      })
      onGuardado()
    } catch (err) {
      console.error('[ModalInscribirJugadorDelegado]', err)
      setError(err.message || 'No se pudo inscribir al jugador.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">Inscribir jugador</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Nombre completo</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => actualizar('nombre', e.target.value)}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-ink mb-1">Número de camiseta (opcional)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.numeroCamiseta}
              onChange={(e) => actualizar('numeroCamiseta', e.target.value.replace(/\D/g, '').slice(0, 2))}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>

          <label className="mb-4 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.esJale}
              onChange={(e) => actualizar('esJale', e.target.checked)}
              className="h-4 w-4 shrink-0 accent-brand"
            />
            Es jale (no es de esta promoción/equipo)
          </label>

          {error && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Inscribir jugador'}
          </button>
        </form>
      </div>
    </div>
  )
}
