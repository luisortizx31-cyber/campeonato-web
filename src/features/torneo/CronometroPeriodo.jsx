import { useEffect, useRef, useState } from 'react'
import {
  iniciarPeriodoPartido,
  finalizarPeriodoPartido,
  reiniciarPeriodoPartido,
} from '../../services/torneoPartidosService'
import { formatearHoraCorta } from '../../utils/fixtureTorneo'
import { formatearCronometro, formatearDuracionMinutos } from '../../utils/cronometro'
import { useCronometro } from '../../hooks/useCronometro'
import { sonarAvisoTiempo, sonarFinTiempo, desbloquearAudio } from '../../utils/sonidoAlerta'

const SEGUNDOS_AVISO = 3 * 60 // a partir de cuántos segundos restantes se pone amarillo + suena el aviso

// Duración sugerida al abrir el campo por primera vez (se puede
// cambiar libremente antes de tocar "Iniciar") - solo un punto de
// partida razonable, no un límite.
const DURACION_SUGERIDA = { primerTiempo: 25, segundoTiempo: 25, tiempoExtra: 10 }

/**
 * Cronómetro de UN tiempo del partido (primer tiempo / segundo tiempo /
 * tiempo extra) - ver ControlPartido -> Cancha. Independiente de
 * horaInicio/horaFin del partido en sí (eso lo maneja "Arrancar
 * partido" / registrarResultadoPartido, no se toca acá): esto lleva
 * la cuenta de cada tiempo por separado, con aviso sonoro + cambio de
 * color cerca de cumplirse la duración configurada. Una vez arrancado
 * sigue corriendo aunque se pase de esa duración - nunca se corta
 * solo, hay que tocar "Finalizar" a mano.
 *
 * `datos` es el campo tal cual viene del doc del partido -
 * { duracionMin, inicio, fin } o null/undefined si nunca se inició.
 * `bloqueado` es true si el partido ya tiene resultado guardado
 * (jugado): ahí queda de solo lectura, igual que el resto de
 * ControlPartido una vez cerrado el partido.
 */
export default function CronometroPeriodo({ partidoId, periodo, datos, bloqueado, hayOtroActivo }) {
  const { segundos, activo, terminado } = useCronometro(datos)
  const [duracionInput, setDuracionInput] = useState(String(DURACION_SUGERIDA[periodo.campo] ?? 25))
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)

  const duracionSeg = (datos?.duracionMin ?? 0) * 60
  const restanteSeg = duracionSeg - segundos
  const vencido = activo && restanteSeg <= 0
  const porVencer = activo && !vencido && restanteSeg <= SEGUNDOS_AVISO

  // El aviso (color + sonido) tiene que sonar UNA sola vez por cada
  // arranque de este tiempo, no en cada segundo que pase dentro de esa
  // franja - la clave es el propio `inicio`, que cambia cada vez que se
  // toca "Iniciar" (incluso si se reinició y se volvió a arrancar).
  const inicioKey = datos?.inicio?.toMillis?.() ?? null
  const avisoSonadoRef = useRef(null)
  const finSonadoRef = useRef(null)
  useEffect(() => {
    if (!activo) return
    if (porVencer && avisoSonadoRef.current !== inicioKey) {
      avisoSonadoRef.current = inicioKey
      sonarAvisoTiempo()
    }
    if (vencido && finSonadoRef.current !== inicioKey) {
      finSonadoRef.current = inicioKey
      sonarFinTiempo()
    }
  }, [activo, porVencer, vencido, inicioKey])

  async function handleIniciar() {
    const min = Number(duracionInput)
    if (!min || min <= 0) {
      setError('Poné una duración válida en minutos.')
      return
    }
    // Justo en este click (gesto real del usuario) para que el aviso de
    // "3 minutos" y el de fin, minutos después sin ningún click nuevo,
    // puedan sonar igual - ver sonidoAlerta.desbloquearAudio.
    desbloquearAudio()
    setError(null)
    setProcesando(true)
    try {
      await iniciarPeriodoPartido(partidoId, periodo.campo, min)
    } catch (err) {
      console.error('[CronometroPeriodo] iniciar', err)
      setError('No se pudo arrancar el cronómetro.')
    } finally {
      setProcesando(false)
    }
  }

  async function handleFinalizar() {
    setProcesando(true)
    setError(null)
    try {
      await finalizarPeriodoPartido(partidoId, periodo.campo)
    } catch (err) {
      console.error('[CronometroPeriodo] finalizar', err)
      setError('No se pudo finalizar el tiempo.')
    } finally {
      setProcesando(false)
    }
  }

  async function handleReiniciar() {
    if (
      !confirm(
        `¿Borrar el cronómetro de "${periodo.label}"? Se pierde la hora en que arrancó/terminó - se puede volver a iniciar de cero.`
      )
    )
      return
    setProcesando(true)
    setError(null)
    try {
      await reiniciarPeriodoPartido(partidoId, periodo.campo)
    } catch (err) {
      console.error('[CronometroPeriodo] reiniciar', err)
      setError('No se pudo reiniciar.')
    } finally {
      setProcesando(false)
    }
  }

  // Partido ya finalizado: si este tiempo nunca se usó, ni vale la pena
  // mostrarlo - no hay nada que corregir ni que mirar.
  if (bloqueado && !datos) return null

  if (terminado) {
    return (
      <div className="rounded-xl border border-line bg-surface px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink">{periodo.label}</p>
          <p className="shrink-0 text-[11px] text-ink-soft">
            {formatearHoraCorta(datos.inicio)} – {formatearHoraCorta(datos.fin)}
          </p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-sm font-bold tabular-nums text-ink">
            Duró {formatearDuracionMinutos(datos.fin.toMillis() - datos.inicio.toMillis())}
          </p>
          {!bloqueado && (
            <button
              onClick={handleReiniciar}
              disabled={procesando}
              className="shrink-0 text-[11px] font-medium text-ink-soft underline disabled:opacity-50"
            >
              Reiniciar
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
      </div>
    )
  }

  if (activo) {
    return (
      <div
        className={`rounded-xl border px-3 py-2.5 transition-colors ${
          vencido
            ? 'border-danger bg-danger'
            : porVencer
              ? 'border-warning bg-warning-soft'
              : 'border-line bg-surface'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p
            className={`flex items-center gap-1.5 text-xs font-semibold ${
              vencido ? 'text-white' : porVencer ? 'text-warning' : 'text-ink'
            }`}
          >
            {vencido && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
            {periodo.label}
          </p>
          <p className={`shrink-0 text-[11px] ${vencido ? 'text-white/70' : porVencer ? 'text-warning/80' : 'text-ink-soft'}`}>
            de {datos.duracionMin} min
          </p>
        </div>
        <p className={`my-1 text-center text-3xl font-bold tabular-nums ${vencido ? 'text-white' : porVencer ? 'text-warning' : 'text-ink'}`}>
          {formatearCronometro(segundos)}
        </p>
        {vencido && (
          <p className="mb-1.5 text-center text-[11px] font-medium text-white">
            Se cumplió el tiempo - sigue corriendo hasta que lo finalices.
          </p>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={handleFinalizar}
            disabled={procesando}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50 ${
              vencido ? 'bg-white text-danger' : 'border border-line bg-paper text-ink'
            }`}
          >
            {procesando ? '…' : `Finalizar ${periodo.label.toLowerCase()}`}
          </button>
          <button
            onClick={handleReiniciar}
            disabled={procesando}
            title="Borrar este cronómetro y empezar de nuevo"
            className={`rounded-lg px-2.5 text-xs font-medium disabled:opacity-50 ${vencido ? 'text-white/80' : 'text-ink-soft'}`}
          >
            ✕
          </button>
        </div>
        {error && <p className={`mt-1 text-[11px] font-medium ${vencido ? 'text-white' : 'text-danger'}`}>{error}</p>}
      </div>
    )
  }

  if (bloqueado) return null // partido cerrado y este tiempo nunca se inició: nada que mostrar

  // Sin empezar: formulario para poner la duración y arrancar.
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-soft">{periodo.label}</p>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={duracionInput}
          onChange={(e) => setDuracionInput(e.target.value)}
          disabled={procesando || hayOtroActivo}
          className="no-spinner w-14 shrink-0 rounded-md border border-line bg-paper px-1.5 py-1 text-center text-xs text-ink outline-none focus-visible:border-brand disabled:opacity-50"
        />
        <span className="shrink-0 text-[11px] text-ink-soft">min</span>
        <button
          onClick={handleIniciar}
          disabled={procesando || hayOtroActivo}
          title={hayOtroActivo ? 'Terminá el tiempo que está corriendo antes de iniciar otro' : undefined}
          className="shrink-0 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
        >
          {procesando ? '…' : '▶ Iniciar'}
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
    </div>
  )
}
