import { useEffect, useState } from 'react'
import { motivoHorarioInvalido } from '../../utils/horariosPartido'

const HORAS = Array.from({ length: 12 }, (_, i) => i + 1) // 1..12
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')) // 00,05,...,55

function pad(n) {
  return String(n).padStart(2, '0')
}

function aPartes(fecha) {
  if (!fecha) return { fechaStr: '', hora: '12', minuto: '00', ampm: 'AM' }
  const d = fecha.toDate ? fecha.toDate() : fecha
  const hora24 = d.getHours()
  const ampm = hora24 >= 12 ? 'PM' : 'AM'
  let hora = hora24 % 12
  if (hora === 0) hora = 12
  // Redondea al multiplo de 5 mas cercano - el selector de minutos
  // solo ofrece esos (ver MINUTOS), asi que una hora guardada con otro
  // minuto (ej. cargada por otro camino) no queda "atascada" sin
  // ninguna opcion que la represente.
  const minutoRedondeado = Math.round(d.getMinutes() / 5) * 5 % 60
  return { fechaStr: aClaveDia(d), hora: String(hora), minuto: pad(minutoRedondeado), ampm }
}

function aClaveDia(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function aFecha({ fechaStr, hora, minuto, ampm }) {
  if (!fechaStr) return null
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  let hora24 = Number(hora) % 12
  if (ampm === 'PM') hora24 += 12
  return new Date(anio, mes - 1, dia, hora24, Number(minuto))
}

function formatearPreview(fechaStr) {
  if (!fechaStr) return null
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Partes (hora 1-12, minuto, AM/PM) de un minuto del dia (0..1439).
function partesDeMinutoDelDia(fechaStr, minutoDelDia) {
  const hora24 = Math.floor(minutoDelDia / 60)
  return {
    fechaStr,
    hora: String(hora24 % 12 === 0 ? 12 : hora24 % 12),
    minuto: pad(minutoDelDia % 60),
    ampm: hora24 >= 12 ? 'PM' : 'AM',
  }
}

function minutoDelDia(partes) {
  return ((Number(partes.hora) % 12) + (partes.ampm === 'PM' ? 12 : 0)) * 60 + Number(partes.minuto)
}

/**
 * Selector de dia+hora para programar partidos (ver TabFechas y
 * ModalReprogramarFecha). No usa <input type="datetime-local"> porque
 * ese widget nativo se muestra en 12h o 24h segun el idioma/SO del
 * navegador - no se puede forzar desde la pagina. Aca la hora se arma
 * a mano con hora(1-12)/minuto/AM-PM para que quede siempre igual sin
 * importar el dispositivo. El dia usa <input type="date"> (calendario
 * nativo, mas comodo para elegir) mas una vista previa en español
 * ("dom 5 set") debajo, ya que el input en si tambien muestra su
 * propio formato nativo mientras se edita.
 *
 * `value` es un Date de JS o un Timestamp de Firestore (o null);
 * `onChange` siempre devuelve un Date de JS o null.
 *
 * `restriccion` (opcional, ver utils/horariosPartido) es
 * { minimo, ocupados }: los horarios que no se pueden elegir quedan
 * desactivados en los selectores - los anteriores o iguales al
 * `minimo` (el partido de arriba) y los `ocupados` por otro partido -
 * y los dias anteriores al del `minimo` no se pueden elegir en el
 * calendario. Si al tocar un selector el horario resultante no se
 * puede usar, salta solo al primer horario permitido cercano.
 * `sinElegir` marca un horario que todavia no se eligio (muestra un
 * aviso en vez de validarlo); `mostrarAviso` en false oculta el aviso
 * rojo de horario no permitido.
 */
export function SelectorFechaHora({ value, onChange, disabled, restriccion, sinElegir = false, mostrarAviso = true }) {
  const [partes, setPartes] = useState(() => aPartes(value))

  useEffect(() => {
    setPartes(aPartes(value))
  }, [value])

  function esValido(fecha) {
    return !motivoHorarioInvalido(fecha, restriccion)
  }

  // Si la combinacion armada cae en un horario no permitido, busca el
  // primero permitido de ese dia desde la hora elegida en adelante (o
  // el primero del dia si ya no queda ninguno despues).
  function corregir(nuevasPartes) {
    if (!nuevasPartes.fechaStr || esValido(aFecha(nuevasPartes))) return nuevasPartes
    const elegido = minutoDelDia(nuevasPartes)
    let primero = null
    for (let m = 0; m < 24 * 60; m += 5) {
      const candidato = partesDeMinutoDelDia(nuevasPartes.fechaStr, m)
      if (!esValido(aFecha(candidato))) continue
      if (m >= elegido) return candidato
      if (!primero) primero = candidato
    }
    return primero || nuevasPartes
  }

  function actualizar(campo, valor) {
    const nuevasPartes = corregir({ ...partes, [campo]: valor })
    setPartes(nuevasPartes)
    onChange(aFecha(nuevasPartes))
  }

  // Un valor de un selector queda desactivado si, con el resto de lo ya
  // elegido, no hay forma de armar un horario permitido. Sin dia elegido
  // todavia no hay nada que comparar.
  const conDia = Boolean(partes.fechaStr) && Boolean(restriccion)
  const horaDesactivada = (h) =>
    conDia && MINUTOS.every((m) => !esValido(aFecha({ ...partes, hora: String(h), minuto: m })))
  const minutoDesactivado = (m) => conDia && !esValido(aFecha({ ...partes, minuto: m }))
  const ampmDesactivado = (ampm) =>
    conDia && HORAS.every((h) => MINUTOS.every((m) => !esValido(aFecha({ ...partes, ampm, hora: String(h), minuto: m }))))

  const diaMinimo = restriccion?.minimo ? aClaveDia(restriccion.minimo) : undefined
  const preview = formatearPreview(partes.fechaStr)
  const valorFecha = value ? (value.toDate ? value.toDate() : value) : null
  const aviso = mostrarAviso && !sinElegir ? motivoHorarioInvalido(valorFecha, restriccion) : null

  return (
    <div className="space-y-1.5">
      <div>
        <input
          type="date"
          value={partes.fechaStr}
          min={diaMinimo}
          disabled={disabled}
          onChange={(e) => actualizar('fechaStr', e.target.value)}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        />
        {preview && <p className="mt-1 text-xs text-ink-soft capitalize">{preview}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={partes.hora}
          disabled={disabled}
          onChange={(e) => actualizar('hora', e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        >
          {HORAS.map((h) => (
            <option key={h} value={h} disabled={horaDesactivada(h)}>{h}</option>
          ))}
        </select>
        <span className="text-ink-soft">:</span>
        <select
          value={partes.minuto}
          disabled={disabled}
          onChange={(e) => actualizar('minuto', e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        >
          {MINUTOS.map((m) => (
            <option key={m} value={m} disabled={minutoDesactivado(m)}>{m}</option>
          ))}
        </select>
        <select
          value={partes.ampm}
          disabled={disabled}
          onChange={(e) => actualizar('ampm', e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        >
          <option value="AM" disabled={ampmDesactivado('AM')}>AM</option>
          <option value="PM" disabled={ampmDesactivado('PM')}>PM</option>
        </select>
      </div>
      {sinElegir && <p className="text-xs text-ink-soft">Todavía sin horario: elegí la hora de este partido.</p>}
      {aviso && <p className="text-xs font-medium text-danger">⚠ {aviso}</p>}
    </div>
  )
}
