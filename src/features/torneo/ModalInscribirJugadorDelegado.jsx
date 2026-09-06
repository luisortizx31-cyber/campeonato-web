import { useEffect, useState } from 'react'
import {
  registrarJugador,
  actualizarJugador,
  obtenerDatosPrivadosJugador,
  actualizarDatosPrivadosJugador,
} from '../../services/torneoJugadoresService'
import { consultarDni } from '../../services/dniLookupService'

/**
 * Version para el delegado (ver TabMiEquipoDelegado) de
 * ModalRegistrarJugador: mismos campos que usa el Maestro (DNI y
 * telefono incluidos, con la misma validacion RENIEC) y sirve tanto
 * para inscribir como para editar (prop `jugador`), pero sin selector
 * de equipo (siempre el suyo, fijo) y sin el chequeo de DNI duplicado
 * entre equipos - eso queda para cuando el Maestro revise el plantel
 * completo desde Jugadores, para no darle al delegado permiso de leer
 * datos privados de jugadores de otros equipos (ver firestore.rules,
 * /torneo_jugadores/privado).
 */
export default function ModalInscribirJugadorDelegado({ torneoId, categoria, equipoId, jugadores, jugador, onCerrar, onGuardado }) {
  const esEdicion = Boolean(jugador)
  const [form, setForm] = useState({
    nombre: jugador?.nombre || '',
    numeroCamiseta: jugador?.numeroCamiseta || '',
    esJale: jugador?.esJale || false,
    dni: '',
    telefono: '',
  })
  const [cargandoDni, setCargandoDni] = useState(esEdicion)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [validacionDni, setValidacionDni] = useState(null) // null | 'cargando' | {data} | 'no_encontrado' | 'error_conexion'

  useEffect(() => {
    if (!esEdicion) return
    let cancelado = false
    obtenerDatosPrivadosJugador(jugador.id)
      .then(({ dni, telefono }) => {
        if (!cancelado) setForm((f) => ({ ...f, dni: dni || '', telefono: telefono || '' }))
      })
      .finally(() => {
        if (!cancelado) setCargandoDni(false)
      })
    return () => {
      cancelado = true
    }
  }, [esEdicion, jugador?.id])

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function handleDni(valor) {
    actualizar('dni', valor.replace(/\D/g, '').slice(0, 8))
    setValidacionDni(null)
  }

  async function handleBlurDni() {
    if (form.dni.length !== 8) return
    setValidacionDni('cargando')
    try {
      const data = await consultarDni(form.dni)
      setValidacionDni({ data })
      if (data?.fullName) actualizar('nombre', data.fullName)
    } catch (err) {
      console.error('[ModalInscribirJugadorDelegado] consultarDni', err)
      setValidacionDni(err instanceof TypeError ? 'error_conexion' : 'no_encontrado')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (form.numeroCamiseta) {
      const numero = Number(form.numeroCamiseta)
      const duplicado = jugadores.find((j) => j.id !== jugador?.id && j.numeroCamiseta === numero)
      if (duplicado) {
        setError(`El número ${numero} ya lo tiene ${duplicado.nombre}.`)
        return
      }
    }

    setEnviando(true)
    try {
      if (esEdicion) {
        await actualizarJugador(jugador.id, { equipoId, nombre: form.nombre, numeroCamiseta: form.numeroCamiseta, esJale: form.esJale })
        await actualizarDatosPrivadosJugador(jugador.id, { torneoId, dni: form.dni, telefono: form.telefono })
      } else {
        await registrarJugador({
          torneoId,
          categoria,
          equipoId,
          nombre: form.nombre,
          numeroCamiseta: form.numeroCamiseta,
          esJale: form.esJale,
          dni: form.dni,
          telefono: form.telefono,
        })
      }
      onGuardado()
    } catch (err) {
      console.error('[ModalInscribirJugadorDelegado]', err)
      setError(err.message || 'No se pudo guardar el jugador.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">{esEdicion ? 'Editar jugador' : 'Inscribir jugador'}</h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">DNI (opcional)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.dni}
              disabled={cargandoDni}
              onChange={(e) => handleDni(e.target.value)}
              onBlur={handleBlurDni}
              placeholder="12345678"
              maxLength={8}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            />
            {validacionDni === 'cargando' && <p className="mt-1 text-xs text-ink-soft">Buscando…</p>}
            {validacionDni === 'no_encontrado' && (
              <p className="mt-1 text-xs text-warning">No se encontró información pública de este DNI.</p>
            )}
            {validacionDni === 'error_conexion' && (
              <p className="mt-1 text-xs text-warning">
                No se pudo conectar con el servicio de verificación. Completa el nombre a mano.
              </p>
            )}
            {validacionDni?.data && (
              <p className="mt-1 text-xs text-success">✓ {validacionDni.data.fullName}</p>
            )}
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            El DNI queda guardado solo para el administrador del torneo, nunca se muestra en el link público.
          </p>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink mb-1">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => actualizar('telefono', e.target.value)}
              placeholder="987654321"
              className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>
          <p className="mb-4 text-xs text-ink-soft">Tampoco se muestra en el link público.</p>

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
            {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Inscribir jugador'}
          </button>
        </form>
      </div>
    </div>
  )
}
