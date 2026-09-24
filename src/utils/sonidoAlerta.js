// Sonidos cortos generados con WebAudio (sin archivos que cargar) para
// avisar del cronometro de un tiempo del partido - ver
// CronometroPeriodo. El AudioContext se crea recien al primer uso,
// siempre disparado por un click real del Maestro ("Iniciar tiempo"):
// los navegadores bloquean el audio que no arranca de un gesto del
// usuario, asi que crearlo antes (ej. al cargar la pagina) no sonaria.
let audioCtx = null

function contexto() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Los navegadores solo dejan crear/reanudar un AudioContext dentro de
// un gesto real del usuario (click, tap) - si se creara recien cuando
// falta el aviso de "3 minutos" (sin ningun click en ese instante
// exacto), el sonido queda bloqueado en silencio. Por eso
// CronometroPeriodo llama a esto apenas se toca "Iniciar" (el propio
// click que arranca el cronómetro), aunque todavía no haya nada que
// sonar - así el contexto ya queda "desbloqueado" para cuando el
// aviso o el fin del tiempo lo necesiten, minutos después, sin click.
export function desbloquearAudio() {
  try {
    contexto()
  } catch {
    // Sin audio: los avisos de este tiempo van a quedar solo visuales
    // (cambio de color), sin sonido.
  }
}

function tono(ctx, frecuencia, inicio, duracion, volumen) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frecuencia
  gain.gain.setValueAtTime(0.0001, inicio)
  gain.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(inicio)
  osc.stop(inicio + duracion + 0.02)
}

// Un tono suave - "faltan 3 minutos para que se cumpla este tiempo".
export function sonarAvisoTiempo() {
  try {
    const ctx = contexto()
    tono(ctx, 740, ctx.currentTime, 0.18, 0.2)
  } catch {
    // Sin audio (navegador viejo, permisos bloqueados, etc.): el
    // cambio de color en pantalla sigue avisando igual.
  }
}

// Tres tonos seguidos, mas urgente - "se cumplio la duracion de este tiempo".
export function sonarFinTiempo() {
  try {
    const ctx = contexto()
    const t0 = ctx.currentTime
    ;[660, 660, 880].forEach((f, i) => tono(ctx, f, t0 + i * 0.22, 0.18, 0.25))
  } catch {
    // Igual que sonarAvisoTiempo: si falla, el color ya avisa.
  }
}
