import { useEffect, useState } from 'react'

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
  return { fechaStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hora: String(hora), minuto: pad(minutoRedondeado), ampm }
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
 */
export function SelectorFechaHora({ value, onChange, disabled }) {
  const [partes, setPartes] = useState(() => aPartes(value))

  useEffect(() => {
    setPartes(aPartes(value))
  }, [value])

  function actualizar(campo, valor) {
    const nuevasPartes = { ...partes, [campo]: valor }
    setPartes(nuevasPartes)
    onChange(aFecha(nuevasPartes))
  }

  const preview = formatearPreview(partes.fechaStr)

  return (
    <div className="space-y-1.5">
      <div>
        <input
          type="date"
          value={partes.fechaStr}
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
            <option key={h} value={h}>{h}</option>
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
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={partes.ampm}
          disabled={disabled}
          onChange={(e) => actualizar('ampm', e.target.value)}
          className="rounded-lg border border-line bg-paper px-2 py-2 text-sm text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  )
}
