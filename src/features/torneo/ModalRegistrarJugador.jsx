import { useEffect, useState } from 'react'
import {
  registrarJugador,
  actualizarJugador,
  obtenerDatosPrivadosJugador,
  actualizarDatosPrivadosJugador,
  buscarJugadorPorDni,
} from '../../services/torneoJugadoresService'
import { consultarDni } from '../../services/dniLookupService'
import { CATEGORIA_TORNEO_LABELS } from '../../models/torneo'

/**
 * Modal para registrar o editar un jugador. El selector de equipo solo
 * ofrece equipos de la categoria ya fijada (prop `equipos`), asi que
 * el campo `categoria` del jugador nunca puede quedar desincronizado
 * de su equipo.
 *
 * El DNI vive en una subcoleccion privada (ver torneoJugadoresService)
 * y nunca se expone en el link publico del torneo.
 */
export default function ModalRegistrarJugador({ torneoId, categoria, equipos, jugadores = [], maximoJugadoresInscritos = null, equipoIdInicial, jugador, onCerrar, onGuardado }) {
  const esEdicion = Boolean(jugador)
  const [form, setForm] = useState({
    equipoId: jugador?.equipoId || equipoIdInicial || equipos[0]?.id || '',
    nombre: jugador?.nombre || '',
    numeroCamiseta: jugador?.numeroCamiseta || '',
    esJale: jugador?.esJale || false,
    dni: '',
    telefono: '',
  })
  const [cargandoDni, setCargandoDni] = useState(esEdicion)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  // Validacion RENIEC (misma API que usa el registro de clientes de
  // prestamos, ver dniLookupService) - autocompleta el nombre y nunca
  // bloquea el envio por si sola, es solo informativa.
  const [validacionDni, setValidacionDni] = useState(null) // null | 'cargando' | {data} | 'no_encontrado'

  // Este SI bloquea el envio: no se puede inscribir dos veces al mismo
  // DNI en la misma categoria (en cualquier equipo).
  const [jugadorDuplicado, setJugadorDuplicado] = useState(null)

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
    setJugadorDuplicado(null)
  }

  async function handleBlurDni() {
    if (form.dni.length !== 8) return

    setValidacionDni('cargando')
    try {
      const data = await consultarDni(form.dni)
      setValidacionDni({ data })
      if (data?.fullName) actualizar('nombre', data.fullName)
    } catch (err) {
      console.error('[ModalRegistrarJugador] consultarDni', err)
      // fetch() tira TypeError cuando ni siquiera pudo conectarse (ej.
      // CORS en localhost) - eso NO es lo mismo que "DNI no
      // encontrado" (el servicio respondio pero sin datos).
      setValidacionDni(err instanceof TypeError ? 'error_conexion' : 'no_encontrado')
    }

    try {
      const existente = await buscarJugadorPorDni(torneoId, categoria, form.dni)
      setJugadorDuplicado(existente && existente.id !== jugador?.id ? existente : null)
    } catch (err) {
      console.error('[ModalRegistrarJugador] buscarJugadorPorDni', err)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.equipoId) {
      setError('Elige un equipo.')
      return
    }

    // Re-chequeo justo antes de guardar, no solo en el blur, por si
    // pegaron el DNI y enviaron sin pasar por ahi.
    if (form.dni.length === 8) {
      const existente = await buscarJugadorPorDni(torneoId, categoria, form.dni).catch(() => null)
      if (existente && existente.id !== jugador?.id) {
        setJugadorDuplicado(existente)
        const equipoExistente = equipos.find((eq) => eq.id === existente.equipoId)?.nombre
        setError(`Ya hay un jugador inscrito con este DNI: ${existente.nombre}${equipoExistente ? ` (${equipoExistente})` : ''}.`)
        return
      }
    }

    // Dos jugadores del MISMO equipo no pueden compartir numero de
    // camiseta (entre equipos distintos si, cada uno numera su
    // plantel por su cuenta).
    if (form.numeroCamiseta) {
      const numero = Number(form.numeroCamiseta)
      const duplicadoCamiseta = jugadores.find(
        (j) => j.id !== jugador?.id && j.equipoId === form.equipoId && j.numeroCamiseta === numero
      )
      if (duplicadoCamiseta) {
        setError(`El número ${numero} ya lo tiene ${duplicadoCamiseta.nombre} en este equipo.`)
        return
      }
    }

    // Tope de jugadores ACTIVOS por equipo (ver Configuracion) - se
    // excluye al propio jugador que se esta editando, para no contarlo
    // dos veces si no cambio de equipo.
    if (maximoJugadoresInscritos) {
      const inscritosEquipo = jugadores.filter(
        (j) => j.id !== jugador?.id && j.equipoId === form.equipoId && !j.eliminado
      ).length
      if (inscritosEquipo >= maximoJugadoresInscritos) {
        setError(`Este equipo ya tiene el máximo de ${maximoJugadoresInscritos} jugadores inscritos.`)
        return
      }
    }

    setEnviando(true)
    try {
      if (esEdicion) {
        await actualizarJugador(jugador.id, form)
        await actualizarDatosPrivadosJugador(jugador.id, { torneoId, dni: form.dni, telefono: form.telefono })
      } else {
        await registrarJugador({ torneoId, categoria, ...form })
      }
      onGuardado()
    } catch (err) {
      console.error('[ModalRegistrarJugador]', err)
      setError(err.message || 'No se pudo guardar el jugador.')
    } finally {
      setEnviando(false)
    }
  }

  const equipoDuplicado = jugadorDuplicado ? equipos.find((eq) => eq.id === jugadorDuplicado.equipoId)?.nombre : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-paper shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h1 className="text-lg font-semibold text-ink">
            {esEdicion ? 'Editar jugador' : 'Nuevo jugador'} · {CATEGORIA_TORNEO_LABELS[categoria]}
          </h1>
          <button onClick={onCerrar} className="text-2xl leading-none text-ink-soft px-1">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-ink">Equipo</label>
            <select
              required
              value={form.equipoId}
              onChange={(e) => actualizar('equipoId', e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            >
              {equipos.length === 0 && <option value="">Sin equipos creados</option>}
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
          </div>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink">DNI (opcional)</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.dni}
              disabled={cargandoDni}
              onChange={(e) => handleDni(e.target.value)}
              onBlur={handleBlurDni}
              placeholder="12345678"
              maxLength={8}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-ink outline-none focus-visible:border-brand disabled:opacity-50"
            />
            {validacionDni === 'cargando' && <p className="mt-1 text-xs text-ink-soft">Buscando…</p>}
            {validacionDni === 'no_encontrado' && (
              <p className="mt-1 text-xs text-warning">No se encontró información pública de este DNI.</p>
            )}
            {validacionDni === 'error_conexion' && (
              <p className="mt-1 text-xs text-warning">
                No se pudo conectar con el servicio de verificación (normal en localhost — funciona
                en producción). Completa el nombre a mano.
              </p>
            )}
            {validacionDni?.data && (
              <p className="mt-1 text-xs text-success">✓ {validacionDni.data.fullName}</p>
            )}
            {jugadorDuplicado && (
              <p className="mt-1 text-xs font-medium text-danger">
                ⚠ Este DNI ya está inscrito como "{jugadorDuplicado.nombre}"{equipoDuplicado ? ` (${equipoDuplicado})` : ''}.
              </p>
            )}
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            El DNI queda guardado solo para ti, nunca se muestra en el link publico del torneo.
          </p>

          <div className="mb-1">
            <label className="block text-sm font-medium text-ink">Teléfono (opcional)</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => actualizar('telefono', e.target.value)}
              placeholder="987654321"
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
            />
          </div>
          <p className="mb-4 text-xs text-ink-soft">
            Tampoco se muestra en el link público — sirve para que puedas escribirle por WhatsApp
            desde la lista de jugadores.
          </p>

          <Campo label="Nombre completo" value={form.nombre} onChange={(v) => actualizar('nombre', v)} />

          <Campo
            label="Numero de camiseta (opcional)"
            value={form.numeroCamiseta}
            onChange={(v) => actualizar('numeroCamiseta', v.replace(/\D/g, '').slice(0, 2))}
            required={false}
            inputMode="numeric"
          />

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
            disabled={enviando || equipos.length === 0 || Boolean(jugadorDuplicado)}
            className="mt-2 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enviando ? 'Guardando…' : 'Registrar jugador'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange, required = true, inputMode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-ink">{label}</label>
      <input
        type="text"
        inputMode={inputMode}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
      />
    </div>
  )
}
