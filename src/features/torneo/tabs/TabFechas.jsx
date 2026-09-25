import { useEffect, useRef, useState } from 'react'
import { listarEquiposPorCategoria } from '../../../services/torneoEquiposService'
import {
  listarPartidosPorCategoria,
  generarFixture,
  reiniciarResultadosTodasLasFechas,
  reiniciarTemporadaCompleta,
  registrarResultadoPartido,
  reiniciarPartidoCompleto,
  actualizarFechaProgramada,
  eliminarPartido,
  cambiarFechaDePartido,
  habilitarAlineacionDeFecha,
} from '../../../services/torneoPartidosService'
import { reconciliarSuspensionesPorFecha } from '../../../services/torneoTarjetasService'
import { suscribirSolicitudesPendientesPorCategoria } from '../../../services/torneoSolicitudesCambioService'
import {
  calcularNumeroFechas,
  calcularLegPartido,
  esFechaLiguilla,
  etiquetaLiguilla,
  textoFechas,
  formatearFechaProgramada,
  formatearDiaCorto,
  formatearDiaLargo,
  formatearHoraCorta,
  formatearHora12,
  compararPartidosPorHorario,
} from '../../../utils/fixtureTorneo'
import { calcularRestricciones, motivoHorarioInvalido } from '../../../utils/horariosPartido'
import { CATEGORIA_TORNEO_LABELS, FASE_LIGUILLA } from '../../../models/torneo'
import { useSwipeHorizontal } from '../../../hooks/useSwipeHorizontal'
import ModalAgregarPartidoFecha from '../ModalAgregarPartidoFecha'
import ModalReprogramarFecha from '../ModalReprogramarFecha'
import ControlPartido from '../ControlPartido'
import { EscudoEquipo } from '../../shared/EscudoEquipo'
import { SelectorCategoria } from '../../shared/SelectorCategoria'
import { SelectorFechaHora } from '../../shared/SelectorFechaHora'
import { textoMinutoEnCurso } from '../../../utils/golesPorTiempo'

/**
 * Genera el fixture "todos contra todos" de una categoria (una vez
 * que los equipos ya estan inscritos) y despues permite cargar, fecha
 * por fecha, el resultado de cada partido. La tabla de Posiciones se
 * recalcula sola apenas se guarda un resultado aca (usa los mismos
 * partidos de Firestore).
 *
 * El numero de "Fecha" que asigna el generador es solo una etiqueta
 * interna de organizacion (no hay calendario real en la app) - si el
 * campeonato ya arranco con un sorteo hecho por fuera, no hace falta
 * que coincida: el Maestro busca cada cruce ya jugado (con el
 * buscador) y le carga el resultado ahi, sin importar en que "Fecha"
 * del sistema haya quedado.
 */
// sessionStorage (no localStorage, es solo navegacion efimera dentro
// de la sesion) para que un refresh de pagina mientras se esta
// controlando un partido puntual (ver `partidoControl` mas abajo) no
// tire al Maestro de vuelta a la lista de fechas.
const STORAGE_CATEGORIA = 'campeonato_fechas_categoria'
const STORAGE_PARTIDO_CONTROL_ID = 'campeonato_fechas_partidoControlId'
// Prefijo nada mas - la clave real incluye la categoria (ver
// fechaSeleccionada mas abajo), para que un refresh en "Promo 2002"
// vuelva a su Fecha 4 sin pisar la Fecha 1 que tenia elegida "Promo
// 1996".
const STORAGE_FECHA_SELECCIONADA_PREFIJO = 'campeonato_fechas_fechaSeleccionada_'

// Variable de MODULO (no de React ni sessionStorage) a proposito: un
// refresh real de pagina recarga el modulo entero, asi que vuelve sola
// a `false` - pero cambiar a otra pestaña del panel (Equipos,
// Posiciones, etc) y volver a Fechas NO recarga el modulo, solo
// desmonta/remonta este componente, asi que se mantiene en `true`.
// Sirve para distinguir esos dos casos, que tienen que comportarse
// distinto: un F5 vuelve a la MISMA fecha que se tenia elegida (ver
// sessionStorage arriba), pero volver desde otra pestaña del panel
// tiene que recalcular la fecha mas cercana a jugarse, no quedarse
// pegado a la que se habia mirado antes de irse.
let seEntroAFechasEnEstaCarga = false

export default function TabFechas({ torneoId, categoriasActivas }) {
  const [categoria, setCategoria] = useState(() => {
    try {
      const guardada = sessionStorage.getItem(STORAGE_CATEGORIA)
      return categoriasActivas.includes(guardada) ? guardada : categoriasActivas[0]
    } catch {
      return categoriasActivas[0]
    }
  })
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  // Pedidos de cambio de alineacion de los delegados (ver "Arrancar
  // partido" en ControlPartido) - en vivo para toda la categoria, no
  // solo el partido que se este mirando en ese momento, para que el
  // aviso aparezca sin importar en que pantalla de Fechas este el
  // Maestro ni que tenga que refrescar.
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([])

  const [idaYVuelta, setIdaYVuelta] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [errorGenerar, setErrorGenerar] = useState(null)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
    // Si ya se habia entrado a Fechas en esta misma carga de pagina
    // (se volvio desde otra pestaña del panel), arranca en null a
    // proposito para que cargar() calcule la fecha mas cercana a
    // jugarse en vez de restaurar la ultima que se habia mirado.
    if (seEntroAFechasEnEstaCarga) return null
    try {
      const guardada = sessionStorage.getItem(STORAGE_FECHA_SELECCIONADA_PREFIJO + categoria)
      return guardada != null ? Number(guardada) : null
    } catch {
      return null
    }
  })
  const [busqueda, setBusqueda] = useState('')
  const [formResultados, setFormResultados] = useState({})
  const [guardandoPartido, setGuardandoPartido] = useState(null)
  const [errorGuardar, setErrorGuardar] = useState(null)

  const [reiniciandoResultadosTodas, setReiniciandoResultadosTodas] = useState(false)
  const [errorReiniciarResultadosTodas, setErrorReiniciarResultadosTodas] = useState(null)

  const [reiniciandoTodo, setReiniciandoTodo] = useState(false)
  const [errorReiniciarTodo, setErrorReiniciarTodo] = useState(null)

  const [guardandoTodos, setGuardandoTodos] = useState(false)

  const [modalAgregar, setModalAgregar] = useState(false)
  const [modalReprogramar, setModalReprogramar] = useState(false)
  const [habilitandoDelegados, setHabilitandoDelegados] = useState(false)

  const [eliminandoPartido, setEliminandoPartido] = useState(null)
  const [reiniciandoPartido, setReiniciandoPartido] = useState(null)
  const [cambiandoFechaPartido, setCambiandoFechaPartido] = useState(null)

  const [partidoControl, setPartidoControl] = useState(null)
  const restauroPartidoControl = useRef(false)

  // Se actualiza solo (cada 1 min) para que la pastilla de una Fecha
  // empiece a parpadear apenas se llega a su horario, sin necesidad de
  // que algun dato del partido cambie mientras tanto (ver
  // horaLlegada, mismo criterio que TabFechasPublica).
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    seEntroAFechasEnEstaCarga = true
  }, [])

  // Arranca mostrando directo los partidos de la fecha actual (no la
  // grilla) - asi el Maestro no tiene que tocar nada para ver lo que
  // toca hoy; la grilla queda a un toque de distancia con el boton
  // "Todas las fechas".
  const [verGrillaFechas, setVerGrillaFechas] = useState(false)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_CATEGORIA, categoria)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [categoria])

  // Recuerda la Fecha elegida (por categoria) para que un refresh de
  // pagina vuelva a la misma en vez de saltar a la que calcularia sola
  // (ver cargar() mas abajo) - esa cuenta solo como "primera vez que se
  // entra a esta categoria", no despues de cada refresh.
  useEffect(() => {
    try {
      if (fechaSeleccionada != null) {
        sessionStorage.setItem(STORAGE_FECHA_SELECCIONADA_PREFIJO + categoria, String(fechaSeleccionada))
      }
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [categoria, fechaSeleccionada])

  // OJO: este efecto NO puede escribir en sessionStorage hasta que se
  // haya intentado restaurar (ver mas abajo) - partidoControl arranca
  // en null en el primer render, asi que si escribiera desde el
  // principio borraria el id guardado (con removeItem) ANTES de que
  // el efecto de restauracion llegara a leerlo, porque ese espera a
  // que termine la primera carga (cargando pasa a false mas tarde).
  // Eso era justo lo que rompia el refresh: volvia siempre a la lista
  // de fechas en vez de reabrir el Control de Partido.
  useEffect(() => {
    if (!restauroPartidoControl.current) return
    try {
      if (partidoControl) sessionStorage.setItem(STORAGE_PARTIDO_CONTROL_ID, partidoControl.id)
      else sessionStorage.removeItem(STORAGE_PARTIDO_CONTROL_ID)
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no persiste.
    }
  }, [partidoControl])

  // Una sola vez, apenas termina la primera carga: si habia un
  // Control de Partido abierto antes del refresh, lo reabre con el
  // partido ya actualizado (no con una copia vieja del storage).
  useEffect(() => {
    if (restauroPartidoControl.current || cargando) return
    try {
      const idGuardado = sessionStorage.getItem(STORAGE_PARTIDO_CONTROL_ID)
      if (idGuardado) {
        const encontrado = partidos.find((p) => p.id === idGuardado)
        if (encontrado) setPartidoControl(encontrado)
      }
    } catch {
      // Sin sessionStorage (modo privado, etc) simplemente no restaura.
    } finally {
      restauroPartidoControl.current = true
    }
  }, [cargando, partidos])

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const [eq, ps] = await Promise.all([
        listarEquiposPorCategoria(torneoId, categoria),
        listarPartidosPorCategoria(torneoId, categoria),
      ])
      setEquipos(eq)
      setPartidos(ps)
      setFormResultados({})

      // Apenas el equipo de un suspendido termina de jugar su partido de
      // la fecha (aunque otro partido de la misma fecha quede pendiente),
      // esto lo levanta solo - no afecta lo que se ve en esta pestaña, es
      // para que Amonestados y la pagina publica salgan al dia sin que el
      // Maestro tenga que acordarse de nada.
      reconciliarSuspensionesPorFecha(torneoId, categoria, ps).catch((err) =>
        console.error('[TabFechas] reconciliarSuspensionesPorFecha', err)
      )

      const fechas = [...new Set(ps.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
      setFechaSeleccionada((actual) => {
        if (fechas.length === 0) return null
        if (actual && fechas.includes(actual)) return actual
        // Al entrar a la pestaña, arranca en la fecha pendiente cuyo
        // horario programado sea el mas proximo (no simplemente la de
        // menor numero) - asi una fecha reprogramada para mas adelante
        // no tapa a la que en realidad toca jugar hoy (ver
        // programarHorariosDeFecha, que mueve el horario pero no el
        // fechaNumero). Una fecha pendiente sin horario puesto queda al
        // final de este criterio.
        const pendientes = fechas.filter((f) => ps.some((p) => p.fechaNumero === f && p.golesLocal == null))
        if (pendientes.length === 0) return fechas[0]
        const conHorario = pendientes
          .map((f) => {
            const horarios = ps
              .filter((p) => p.fechaNumero === f && p.golesLocal == null && p.fecha)
              .map((p) => p.fecha.toMillis())
            return { f, horario: horarios.length > 0 ? Math.min(...horarios) : Infinity }
          })
          .sort((a, b) => a.horario - b.horario || a.f - b.f)
        return conHorario[0].f
      })
    } catch (err) {
      console.error('[TabFechas]', err)
      setError('No se pudieron cargar los datos del fixture.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [torneoId, categoria])

  useEffect(() => {
    const desuscribir = suscribirSolicitudesPendientesPorCategoria(torneoId, categoria, setSolicitudesPendientes, (err) =>
      console.error('[TabFechas] suscribirSolicitudesPendientesPorCategoria', err)
    )
    return desuscribir
  }, [torneoId, categoria])

  async function handleGenerar() {
    const numFechas = calcularNumeroFechas(equipos.length, idaYVuelta)
    if (!confirm(`¿Generar el fixture de ${CATEGORIA_TORNEO_LABELS[categoria]}? Se crearán ${numFechas} fechas.`)) return
    setGenerando(true)
    setErrorGenerar(null)
    try {
      await generarFixture({ torneoId, categoria, equipoIds: equipos.map((e) => e.id), idaYVuelta })
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGenerar(err.message || 'No se pudo generar el fixture.')
    } finally {
      setGenerando(false)
    }
  }

  // Igual que el reinicio individual por partido (ver ↺ en cada fila)
  // pero para todas las fechas de la categoria a la vez: ademas del
  // resultado, borra goles y tarjetas, levanta cualquier suspension y
  // vacia la alineacion de cada partido (todos los jugadores vuelven a
  // "Jugadores"), reinicia los cronometros de los tiempos y borra la
  // programacion (el dia/hora de cada partido) - el unico que NO se borra
  // es el fixture (los cruces y su numero de fecha quedan igual).
  async function handleReiniciarResultadosTodas() {
    const confirmacion = confirm(
      `¿Reiniciar TODOS los partidos de ${CATEGORIA_TORNEO_LABELS[categoria]}?\n\n` +
        'Todos los partidos vuelven a Pendiente: se borran sus goles, tarjetas y alineación (los jugadores ' +
        'vuelven a "Jugadores"), los cronómetros del primer tiempo, segundo tiempo y tiempo extra, la programación ' +
        '(el día y la hora de cada partido) y se levantan todas las ' +
        'suspensiones. Los cruces del fixture NO se borran, pero tendrás que volver a programar los ' +
        'horarios.\n\nEsta acción no se puede deshacer.'
    )
    if (!confirmacion) return
    setReiniciandoResultadosTodas(true)
    setErrorReiniciarResultadosTodas(null)
    try {
      await reiniciarResultadosTodasLasFechas(torneoId, categoria)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorReiniciarResultadosTodas(err.message || 'No se pudieron reiniciar los resultados.')
    } finally {
      setReiniciandoResultadosTodas(false)
    }
  }

  // Borra TODO lo del campeonato de esta categoria - partidos,
  // tarjetas y sanciones - sin bloquearse por nada, para volver al
  // punto de partida cuando el Maestro quiere empezar de cero (incluye
  // rehacer el fixture desde "Generar fechas"). Los equipos y
  // jugadores registrados se mantienen.
  async function handleReiniciarTodo() {
    const confirmacion = confirm(
      `¿Reiniciar TODO el campeonato de ${CATEGORIA_TORNEO_LABELS[categoria]}?\n\n` +
        'Esto borra todos los partidos, resultados, tarjetas y sanciones de esta categoría. ' +
        'Los equipos y jugadores inscritos NO se borran.\n\nEsta acción no se puede deshacer.'
    )
    if (!confirmacion) return
    setReiniciandoTodo(true)
    setErrorReiniciarTodo(null)
    try {
      await reiniciarTemporadaCompleta(torneoId, categoria)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorReiniciarTodo(err.message || 'No se pudo reiniciar el campeonato.')
    } finally {
      setReiniciandoTodo(false)
    }
  }

  function actualizarResultadoForm(partidoId, campo, valor) {
    setFormResultados((f) => ({ ...f, [partidoId]: { ...f[partidoId], [campo]: valor } }))
  }

  async function handleGuardarResultado(partido) {
    const bloqueante = partidoBloqueadoPor(partido)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, partido.fechaNumero))
      return
    }
    const valores = formResultados[partido.id] || {}
    const golesLocal = valores.golesLocal ?? partido.golesLocal
    const golesVisitante = valores.golesVisitante ?? partido.golesVisitante
    if (golesLocal === '' || golesLocal == null || golesVisitante === '' || golesVisitante == null) {
      setErrorGuardar('Completa el marcador de los dos equipos.')
      return
    }
    setGuardandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await registrarResultadoPartido(partido.id, { golesLocal, golesVisitante })
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo guardar el resultado.')
    } finally {
      setGuardandoPartido(null)
    }
  }

  // Guarda de una sola vez todos los partidos de la fecha actual que
  // el Maestro tocó en este formulario (los que nunca edito no se
  // reescriben). Asi puede llenar todos los marcadores de la fecha y
  // guardar con un solo click, en vez de uno por partido.
  async function handleGuardarTodos() {
    const bloqueante = partidosSinFinalizar.find((p) => p.fechaNumero < fechaSeleccionada)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, fechaSeleccionada))
      return
    }
    const pendientes = partidosDeFecha.filter((p) => {
      const valores = formResultados[p.id]
      return valores && valores.golesLocal !== undefined && valores.golesLocal !== '' &&
        valores.golesVisitante !== undefined && valores.golesVisitante !== ''
    })
    if (pendientes.length === 0) return

    setGuardandoTodos(true)
    setErrorGuardar(null)
    try {
      for (const p of pendientes) {
        const valores = formResultados[p.id]
        await registrarResultadoPartido(p.id, { golesLocal: valores.golesLocal, golesVisitante: valores.golesVisitante })
      }
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudieron guardar los resultados.')
    } finally {
      setGuardandoTodos(false)
    }
  }

  async function handleEliminarPartido(partido) {
    if (!confirm('¿Eliminar este partido?')) return
    setEliminandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await eliminarPartido(partido.id)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo eliminar el partido.')
    } finally {
      setEliminandoPartido(null)
    }
  }

  // Mueve un partido puntual a otra Fecha (ver icono 📅 en la fila) -
  // para el caso de una fecha que se posterga y termina jugandose
  // junto con la siguiente.
  async function handleCambiarFechaPartido(partido, nuevaFecha) {
    setCambiandoFechaPartido(partido.id)
    setErrorGuardar(null)
    try {
      await cambiarFechaDePartido(torneoId, categoria, partido.id, nuevaFecha, partido.equipoLocalId, partido.equipoVisitanteId)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo cambiar la fecha del partido.')
    } finally {
      setCambiandoFechaPartido(null)
    }
  }

  // Reinicio de UN solo partido (icono ↺ en la fila) - borra sus
  // goles y tarjetas y vuelve su resultado a Pendiente, sin tocar el
  // resto de la fecha ni la alineación. Misma logica que el boton
  // "↺ Reiniciar goles y tarjetas" de Control de Partido (ver
  // torneoPartidosService.reiniciarPartidoCompleto), para no tener
  // que entrar a Control solo para corregir un partido puntual.
  async function handleReiniciarPartidoIndividual(partido) {
    if (
      !confirm(
        '¿Reiniciar este partido? Se borran los goles y las tarjetas cargados, y el resultado vuelve a Pendiente. La alineación no se toca.\n\nEsta acción no se puede deshacer.'
      )
    )
      return
    setReiniciandoPartido(partido.id)
    setErrorGuardar(null)
    try {
      await reiniciarPartidoCompleto(partido.id)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo reiniciar el partido.')
    } finally {
      setReiniciandoPartido(null)
    }
  }

  // Dia/hora programado de UN partido (icono 🗓 en la fila) - ver
  // torneoPartidosService.actualizarFechaProgramada. Re-tira el error
  // para que FilaPartido sepa que fallo y se quede en modo edicion en
  // vez de cerrarlo como si hubiera guardado bien.
  async function handleGuardarFechaProgramada(partidoId, fechaHora) {
    setErrorGuardar(null)
    try {
      await actualizarFechaProgramada(partidoId, fechaHora)
      await cargar()
    } catch (err) {
      console.error('[TabFechas]', err)
      setErrorGuardar(err.message || 'No se pudo guardar el horario.')
      throw err
    }
  }

  async function handlePartidoAgregado(fechaNumero) {
    setModalAgregar(false)
    await cargar()
    setFechaSeleccionada(fechaNumero)
  }

  function nombreEquipo(id) {
    return equipos.find((e) => e.id === id)?.nombre || '—'
  }

  // Que horarios se pueden elegir al programar UN partido: tiene que
  // empezar despues de los partidos que van antes en su Fecha y no
  // repetir la hora de otro (ver utils/horariosPartido). Un partido ya
  // jugado no se valida.
  function restriccionHorarioDe(partido) {
    const pendientesDeLaFecha = partidos
      .filter((p) => p.fechaNumero === partido.fechaNumero && p.golesLocal == null)
      .sort(compararPartidosPorHorario)
    return calcularRestricciones(
      pendientesDeLaFecha.map((p) => ({ id: p.id, fecha: p.fecha ? p.fecha.toDate() : null }))
    ).get(partido.id)
  }

  // Partido "en vivo" (alineacion ya cargada, ver enVivo en FilaPartido
  // mas abajo) pero sin finalizar todavia. Mientras alguno de una fecha
  // ANTERIOR quede asi, no se deja tocar (ni abrir Control ni cargar
  // resultado) ningun partido de una fecha posterior - para no repetir
  // el caso de tarjetas "en borrador" que se quedan sin aplicar porque
  // el Maestro sigue de largo con la fecha siguiente sin darse cuenta
  // de que dejo uno a medias (ver torneoTarjetasService.
  // finalizarTarjetasPartido). Una fecha que directamente todavia no
  // arranco (ej. reprogramada para mas adelante) NO bloquea nada - solo
  // una que quedo empezada y sin cerrar.
  function partidoEnVivoSinFinalizar(p) {
    return p.golesLocal == null && (p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  }
  const partidosSinFinalizar = partidos.filter(partidoEnVivoSinFinalizar)

  function partidoBloqueadoPor(partido) {
    return partidosSinFinalizar.find((p) => p.id !== partido.id && p.fechaNumero < partido.fechaNumero)
  }

  function mensajeBloqueo(bloqueante, fechaDestino) {
    return `Primero terminá el partido de ${nombreEquipo(bloqueante.equipoLocalId)} vs ${nombreEquipo(bloqueante.equipoVisitanteId)} (Fecha ${bloqueante.fechaNumero}) antes de seguir con la Fecha ${fechaDestino}.`
  }

  // Al entrar a Control de partido ya no se pregunta nada sobre los
  // delegados: se habilitan (o se cierran) de una vez para toda la Fecha
  // con el boton "Habilitar delegados" (ver handleAlternarDelegados).
  async function handleAbrirControl(partido) {
    const bloqueante = partidoBloqueadoPor(partido)
    if (bloqueante) {
      setErrorGuardar(mensajeBloqueo(bloqueante, partido.fechaNumero))
      return
    }
    setPartidoControl(partido)
  }

  // Habilita (o cierra) que los delegados de los equipos que juegan la
  // Fecha seleccionada armen su alineacion desde el link publico. Solo
  // toca los partidos que todavia no arrancaron ni tienen resultado:
  // una vez arrancado, el delegado ya no edita directo (ver
  // AlineacionPartidoDelegado, pide cambios al Maestro).
  async function handleAlternarDelegados(partidosPendientes, habilitar) {
    if (
      !habilitar &&
      !confirm(`¿Cerrar la alineación de los delegados de la Fecha ${fechaSeleccionada}? Ya no van a poder armarla ni cambiarla.`)
    )
      return
    setHabilitandoDelegados(true)
    setErrorGuardar(null)
    try {
      await habilitarAlineacionDeFecha(
        partidosPendientes.map((p) => p.id),
        habilitar
      )
      await cargar()
    } catch (err) {
      console.error('[TabFechas] handleAlternarDelegados', err)
      setErrorGuardar('No se pudo cambiar el permiso de los delegados.')
    } finally {
      setHabilitandoDelegados(false)
    }
  }

  const fechasDisponibles = [...new Set(partidos.filter((p) => p.fechaNumero != null).map((p) => p.fechaNumero))].sort((a, b) => a - b)
  const hayFixture = fechasDisponibles.length > 0
  const swipeFecha = useSwipeHorizontal(fechasDisponibles, fechaSeleccionada, setFechaSeleccionada)
  // Pendientes de menor a mayor hora programada primero, los ya
  // jugados al final (ver compararPartidosPorHorario).
  const partidosDeFecha = partidos
    .filter((p) => p.fechaNumero === fechaSeleccionada)
    .sort(compararPartidosPorHorario)
  // Partidos de la Fecha a los que todavia se les puede habilitar/cerrar
  // la alineacion de los delegados (sin resultado y sin arrancar), y si
  // ya estan todos habilitados (ambos lados de cada uno).
  const partidosPendientesSinArrancar = partidosDeFecha.filter((p) => p.golesLocal == null && p.horaInicio == null)
  const delegadosHabilitados =
    partidosPendientesSinArrancar.length > 0 &&
    partidosPendientesSinArrancar.every((p) => p.alineacionAbiertaLocal && p.alineacionAbiertaVisitante)
  const partidosPendientes = partidosDeFecha.filter((p) => {
    const valores = formResultados[p.id]
    return valores && valores.golesLocal !== undefined && valores.golesLocal !== '' &&
      valores.golesVisitante !== undefined && valores.golesVisitante !== ''
  })
  const fechaSeleccionadaBloqueadaPor = partidosSinFinalizar.find((p) => p.fechaNumero < fechaSeleccionada)

  function fechaCompleta(f) {
    return partidos.filter((p) => p.fechaNumero === f).every((p) => p.golesLocal != null)
  }

  function fechaEmpezada(f) {
    return partidos
      .filter((p) => p.fechaNumero === f)
      .some((p) => p.golesLocal != null || p.titularesLocal?.length > 0 || p.titularesVisitante?.length > 0)
  }

  // Horario mas temprano entre los partidos de esta Fecha (cualquiera
  // que tenga `fecha` puesto, jugado o no) - se muestra debajo de cada
  // pastilla "Fecha N" (mismo criterio y misma pastilla que
  // TabFechasPublica, para que el Maestro vea la programacion igual
  // que el publico).
  function horarioMasBajoDe(f) {
    const conFecha = partidos.filter((p) => p.fechaNumero === f && p.fecha)
    if (conFecha.length === 0) return null
    return conFecha.sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())[0].fecha
  }

  // Ya se llego (o paso) el horario de esta Fecha y todavia no esta
  // completa - la pastilla parpadea para llamar la atencion (ver
  // animate-pulse mas abajo, mismo criterio que TabFechasPublica).
  function horaLlegada(f) {
    const horario = horarioMasBajoDe(f)
    return horario != null && horario.toMillis() <= ahora && !fechaCompleta(f)
  }

  // Para el chip de dia/hora debajo de la pastilla: si el horario
  // programado ya paso (independiente de si el resultado se cargo o
  // no) se muestra atenuado en vez de dorado, para diferenciar de un
  // vistazo las fechas que todavia estan por jugarse.
  function horarioYaPaso(f) {
    const horario = horarioMasBajoDe(f)
    return horario != null && horario.toMillis() <= ahora
  }

  // Si una fecha es toda "vuelta" (revancha de una fecha anterior),
  // toda "ida", o mixta/sin revancha - se deduce de los cruces (ver
  // calcularLegPartido), no de como se genero el fixture.
  function fechaLeg(f) {
    const partidosF = partidos.filter((p) => p.fechaNumero === f)
    if (partidosF.length === 0) return null
    const legs = new Set(partidosF.map((p) => calcularLegPartido(p, partidos)))
    if (legs.size === 1) return [...legs][0] // 'ida' | 'vuelta' | null
    return 'mixta'
  }
  // La ida/vuelta de la temporada regular y la de la liguilla se cuentan por
  // separado (la liguilla se muestra como "Liguilla ida" / "Liguilla vuelta").
  const fechasLiguilla = fechasDisponibles.filter((f) => esFechaLiguilla(f, partidos))
  const fechasIda = fechasDisponibles.filter((f) => !fechasLiguilla.includes(f) && fechaLeg(f) === 'ida')
  const fechasVuelta = fechasDisponibles.filter((f) => !fechasLiguilla.includes(f) && fechaLeg(f) === 'vuelta')
  const fechasLiguillaIda = fechasLiguilla.filter((f) => fechaLeg(f) === 'ida')
  const fechasLiguillaVuelta = fechasLiguilla.filter((f) => fechaLeg(f) === 'vuelta')

  const busquedaNormalizada = busqueda.trim().toLowerCase()
  const resultadosBusqueda = busquedaNormalizada
    ? partidos
        .filter((p) => p.fechaNumero != null)
        .filter((p) => {
          const local = nombreEquipo(p.equipoLocalId).toLowerCase()
          const visitante = nombreEquipo(p.equipoVisitanteId).toLowerCase()
          return local.includes(busquedaNormalizada) || visitante.includes(busquedaNormalizada)
        })
        .sort((a, b) => a.fechaNumero - b.fechaNumero)
    : []

  if (partidoControl) {
    return (
      <div>
        <ControlPartido
          torneoId={torneoId}
          categoria={categoria}
          partido={partidoControl}
          nombreEquipo={nombreEquipo}
          onVolver={async () => {
            setPartidoControl(null)
            await cargar()
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <SelectorCategoria categorias={categoriasActivas} activa={categoria} onCambiar={setCategoria} />

      {solicitudesPendientes.length > 0 && (
        <div className="mb-3 space-y-2">
          {solicitudesPendientes.map((s) => {
            const p = partidos.find((pp) => pp.id === s.partidoId)
            const rivalId = p && (p.equipoLocalId === s.equipoId ? p.equipoVisitanteId : p.equipoLocalId)
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5"
              >
                <p className="min-w-0 text-xs font-medium text-warning">
                  ⚠ El delegado de {nombreEquipo(s.equipoId)} pidió un cambio
                  {p ? ` - Fecha ${p.fechaNumero} vs ${nombreEquipo(rivalId)}` : ''}
                </p>
                {p && (
                  <button
                    onClick={() => handleAbrirControl(p)}
                    className="shrink-0 rounded-lg bg-warning px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Revisar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {cargando && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      {!cargando && !error && !hayFixture && (
        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Generar fechas</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {equipos.length} equipo(s) inscritos en {CATEGORIA_TORNEO_LABELS[categoria]}.
            </p>
          </div>

          {equipos.length < 2 ? (
            <p className="text-sm text-ink-soft">
              Necesitas al menos 2 equipos inscritos en esta categoría para generar el fixture.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Formato</label>
                <select
                  value={idaYVuelta ? 'true' : 'false'}
                  onChange={(e) => setIdaYVuelta(e.target.value === 'true')}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2.5 text-ink outline-none focus-visible:border-brand"
                >
                  <option value="false">Solo ida (cada equipo juega una vez contra cada rival)</option>
                  <option value="true">Ida y vuelta (cada equipo juega dos veces contra cada rival)</option>
                </select>
              </div>

              <p className="text-sm text-ink-soft">
                Esto va a generar <strong className="text-ink">{calcularNumeroFechas(equipos.length, idaYVuelta)} fechas</strong>.
              </p>

              {errorGenerar && (
                <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorGenerar}</p>
              )}

              <button
                onClick={handleGenerar}
                disabled={generando}
                className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60"
              >
                {generando ? 'Generando…' : 'Generar fechas'}
              </button>
            </>
          )}

          {equipos.length >= 2 && (
            <div className="border-t border-line pt-4">
              <p className="mb-2 text-xs text-ink-soft">
                ¿El campeonato ya arrancó con un sorteo hecho por fuera? Cargá los cruces a mano, fecha
                por fecha, en vez de generar el fixture automático.
              </p>
              <button
                onClick={() => setModalAgregar(true)}
                className="w-full rounded-lg border border-line py-2.5 text-sm font-medium text-ink"
              >
                + Agregar partido a mano
              </button>
            </div>
          )}
        </div>
      )}

      {!cargando && !error && hayFixture && (
        <>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar un cruce por equipo…"
            className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-soft/60 outline-none focus-visible:border-brand"
          />

          {!busquedaNormalizada && (
            <>
              {verGrillaFechas ? (
                <>
                  {fechasVuelta.length > 0 && (
                    <p className="mb-2 text-xs text-ink-soft">
                      <span className="font-semibold text-brand">Ida:</span> Fecha {Math.min(...fechasIda)}–{Math.max(...fechasIda)}
                      {'  ·  '}
                      <span className="font-semibold text-gold">Vuelta:</span> Fecha {Math.min(...fechasVuelta)}–{Math.max(...fechasVuelta)}
                    </p>
                  )}
                  {fechasLiguilla.length > 0 && (
                    <p className="mb-2 text-xs text-ink-soft">
                      <span className="font-semibold text-danger">Liguilla</span>
                      {fechasLiguillaIda.length > 0 && <> · ida: {textoFechas(fechasLiguillaIda)}</>}
                      {fechasLiguillaVuelta.length > 0 && <> · vuelta: {textoFechas(fechasLiguillaVuelta)}</>}
                      {fechasLiguillaIda.length === 0 && fechasLiguillaVuelta.length === 0 && <> · {textoFechas(fechasLiguilla)}</>}
                    </p>
                  )}
                  <div className="mb-3 flex flex-wrap gap-2">
                    {fechasDisponibles.map((f) => {
                      const completa = fechaCompleta(f)
                      const empezada = !completa && fechaEmpezada(f)
                      const activa = fechaSeleccionada === f
                      const enHora = horaLlegada(f)
                      const esLiguillaF = fechasLiguilla.includes(f)
                      const horarioMasBajo = horarioMasBajoDe(f)
                      const yaPaso = horarioYaPaso(f)
                      return (
                        <div key={f} className="flex flex-col items-center gap-0.5">
                          <button
                            onClick={() => {
                              setFechaSeleccionada(f)
                              setVerGrillaFechas(false)
                            }}
                            className={`rounded-full border px-5 py-2.5 text-base font-bold transition-all ${
                              enHora ? 'animate-pulse' : ''
                            } ${
                              activa
                                ? 'border-brand bg-brand text-white shadow-sm'
                                : completa
                                  ? 'border-danger/30 bg-danger-soft text-danger'
                                  : empezada
                                    ? 'border-warning/30 bg-warning-soft text-warning'
                                    : enHora
                                      ? 'border-success/30 bg-success-soft text-success'
                                      : 'border-line bg-surface text-ink-soft'
                            }`}
                          >
                            {esLiguillaF ? `${etiquetaLiguilla(fechaLeg(f))} · F${f}` : `Fecha ${f}`}{completa ? ' ✓' : ''}
                          </button>
                          {horarioMasBajo && (
                            <div
                              className={`flex flex-col items-center whitespace-nowrap rounded-lg px-2 py-1 leading-tight text-white shadow-sm ${
                                yaPaso ? 'bg-ink-soft' : 'bg-gold'
                              }`}
                            >
                              <span className="text-[10px] font-bold">{formatearDiaCorto(horarioMasBajo)}</span>
                              <span className="text-[9px] font-semibold">{formatearHoraCorta(horarioMasBajo)}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setVerGrillaFechas(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm transition-transform active:scale-95"
                  >
                    ← Todas las fechas
                  </button>
                  <div className="flex flex-wrap justify-end gap-2">
                    {partidosPendientesSinArrancar.length > 0 && (
                      <button
                        onClick={() => handleAlternarDelegados(partidosPendientesSinArrancar, !delegadosHabilitados)}
                        disabled={habilitandoDelegados}
                        title={
                          delegadosHabilitados
                            ? 'Los delegados ya pueden armar su alineación. Tocar para cerrarla.'
                            : `Deja que los delegados de los equipos que juegan la Fecha ${fechaSeleccionada} armen su alineación`
                        }
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                          delegadosHabilitados
                            ? 'border-success/30 bg-success-soft text-success'
                            : 'border-line bg-surface text-ink-soft hover:border-brand hover:text-brand'
                        }`}
                      >
                        {habilitandoDelegados
                          ? '…'
                          : delegadosHabilitados
                            ? '✓ Delegados habilitados'
                            : '👥 Habilitar delegados'}
                      </button>
                    )}
                    <button
                      onClick={() => setModalAgregar(true)}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
                    >
                      + Agregar partido
                    </button>
                    <button
                      onClick={() => setModalReprogramar(true)}
                      className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
                    >
                      📅 Programar fecha
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {errorGuardar && !verGrillaFechas && (
            <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorGuardar}</p>
          )}

          {busquedaNormalizada ? (
            resultadosBusqueda.length === 0 ? (
              <p className="text-sm text-ink-soft">No hay ningún cruce que coincida con "{busqueda}".</p>
            ) : (
              <ul className="space-y-2.5">
                {resultadosBusqueda.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    mostrarFecha
                    leg={calcularLegPartido(p, partidos)}
                    form={formResultados[p.id]}
                    onChange={actualizarResultadoForm}
                    onGuardar={handleGuardarResultado}
                    guardando={guardandoPartido === p.id}
                    onEliminar={handleEliminarPartido}
                    eliminando={eliminandoPartido === p.id}
                    onReiniciar={handleReiniciarPartidoIndividual}
                    reiniciando={reiniciandoPartido === p.id}
                    onGuardarHorario={handleGuardarFechaProgramada}
                    restriccionHorario={restriccionHorarioDe(p)}
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={handleAbrirControl}
                    bloqueadoPor={partidoBloqueadoPor(p)}
                    fechasDisponibles={fechasDisponibles}
                    onCambiarFecha={handleCambiarFechaPartido}
                    cambiandoFecha={cambiandoFechaPartido === p.id}
                    ahora={ahora}
                  />
                ))}
              </ul>
            )
          ) : verGrillaFechas ? null : (
            <div {...swipeFecha}>
              {horarioMasBajoDe(fechaSeleccionada) && (
                <div className="mb-3 rounded-2xl border border-line bg-surface px-4 py-3 text-center shadow-sm">
                  <p className="text-lg font-extrabold uppercase leading-tight tracking-wide text-ink">
                    {formatearDiaLargo(horarioMasBajoDe(fechaSeleccionada))}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink-soft">
                    {horarioYaPaso(fechaSeleccionada) ? 'Empezó' : 'Empieza'} a las{' '}
                    {formatearHora12(horarioMasBajoDe(fechaSeleccionada))}
                  </p>
                </div>
              )}
              {fechaSeleccionadaBloqueadaPor && (
                <p className="mb-2.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                  ⚠ Tenés un partido sin finalizar en la Fecha {fechaSeleccionadaBloqueadaPor.fechaNumero} (
                  {nombreEquipo(fechaSeleccionadaBloqueadaPor.equipoLocalId)} vs{' '}
                  {nombreEquipo(fechaSeleccionadaBloqueadaPor.equipoVisitanteId)}) - terminalo antes de cargar
                  resultados de esta fecha.
                </p>
              )}
              <ul className="space-y-2.5">
                {partidosDeFecha.map((p) => (
                  <FilaPartido
                    key={p.id}
                    partido={p}
                    ocultarBoton
                    leg={calcularLegPartido(p, partidos)}
                    form={formResultados[p.id]}
                    onChange={actualizarResultadoForm}
                    onEliminar={handleEliminarPartido}
                    eliminando={eliminandoPartido === p.id}
                    onReiniciar={handleReiniciarPartidoIndividual}
                    reiniciando={reiniciandoPartido === p.id}
                    onGuardarHorario={handleGuardarFechaProgramada}
                    restriccionHorario={restriccionHorarioDe(p)}
                    nombreEquipo={nombreEquipo}
                    onAbrirControl={handleAbrirControl}
                    bloqueadoPor={partidoBloqueadoPor(p)}
                    fechasDisponibles={fechasDisponibles}
                    onCambiarFecha={handleCambiarFechaPartido}
                    cambiandoFecha={cambiandoFechaPartido === p.id}
                    ahora={ahora}
                  />
                ))}
              </ul>

              {partidosDeFecha.length > 0 && (
                <button
                  onClick={handleGuardarTodos}
                  disabled={guardandoTodos || partidosPendientes.length === 0 || Boolean(fechaSeleccionadaBloqueadaPor)}
                  className="mt-3 w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
                >
                  {guardandoTodos
                    ? 'Guardando…'
                    : `Guardar resultados de esta fecha${partidosPendientes.length > 0 ? ` (${partidosPendientes.length})` : ''}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {!cargando && !error && hayFixture && (
        <div className="mt-6 border-t border-line pt-4 text-center">
          {errorReiniciarResultadosTodas && (
            <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorReiniciarResultadosTodas}</p>
          )}
          <button
            onClick={handleReiniciarResultadosTodas}
            disabled={reiniciandoResultadosTodas}
            className="text-xs text-warning underline disabled:opacity-50"
          >
            {reiniciandoResultadosTodas
              ? 'Reiniciando…'
              : `Reiniciar TODOS los partidos de ${CATEGORIA_TORNEO_LABELS[categoria]} (goles, tarjetas, alineación, primer y segundo tiempo y programación de horarios - deja los cruces intactos)`}
          </button>
        </div>
      )}

      {!cargando && !error && (
        <div className="mt-3 border-t border-line pt-4 text-center">
          {errorReiniciarTodo && (
            <p className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{errorReiniciarTodo}</p>
          )}
          <button
            onClick={handleReiniciarTodo}
            disabled={reiniciandoTodo}
            className="text-xs text-danger underline disabled:opacity-50"
          >
            {reiniciandoTodo
              ? 'Reiniciando…'
              : `Reiniciar TODO el campeonato de ${CATEGORIA_TORNEO_LABELS[categoria]} (partidos, tarjetas y sanciones)`}
          </button>
        </div>
      )}

      {modalAgregar && (
        <ModalAgregarPartidoFecha
          torneoId={torneoId}
          categoria={categoria}
          equipos={equipos}
          partidos={partidos}
          fechaSugerida={fechaSeleccionada || Math.max(0, ...fechasDisponibles) + 1}
          onCerrar={() => setModalAgregar(false)}
          onGuardado={handlePartidoAgregado}
        />
      )}

      {modalReprogramar && (
        <ModalReprogramarFecha
          torneoId={torneoId}
          categoria={categoria}
          fechaNumero={fechaSeleccionada}
          partidosDeFecha={partidosDeFecha}
          partidos={partidos}
          nombreEquipo={nombreEquipo}
          onCerrar={() => setModalReprogramar(false)}
          onGuardado={async () => {
            setModalReprogramar(false)
            await cargar()
          }}
        />
      )}
    </div>
  )
}

function FilaPartido({ partido, mostrarFecha, ocultarBoton, leg, form, onChange, onGuardar, guardando, onEliminar, eliminando, onReiniciar, reiniciando, onGuardarHorario, restriccionHorario, nombreEquipo, onAbrirControl, bloqueadoPor, fechasDisponibles, onCambiarFecha, cambiandoFecha, ahora }) {
  const [editandoHorario, setEditandoHorario] = useState(false)
  const [horarioDraft, setHorarioDraft] = useState(null) // Date | null
  const [guardandoHorario, setGuardandoHorario] = useState(false)
  const [editandoFecha, setEditandoFecha] = useState(false)
  const [fechaDraft, setFechaDraft] = useState(partido.fechaNumero)

  // Fechas para elegir en el selector: las que ya existen en el
  // fixture mas una nueva al final (por si se pospone para una fecha
  // que todavia no se creo, ej. "Fecha 11" si el fixture llega hasta
  // la 10).
  const opcionesFecha = fechasDisponibles
    ? [...new Set([...fechasDisponibles, Math.max(0, ...fechasDisponibles) + 1])].sort((a, b) => a - b)
    : []

  function abrirCambioFecha() {
    setFechaDraft(partido.fechaNumero)
    setEditandoFecha(true)
  }

  async function confirmarCambioFecha() {
    if (Number(fechaDraft) === partido.fechaNumero) {
      setEditandoFecha(false)
      return
    }
    await onCambiarFecha(partido, fechaDraft)
    setEditandoFecha(false)
  }

  function abrirEdicionHorario() {
    setHorarioDraft(partido.fecha ? partido.fecha.toDate() : null)
    setEditandoHorario(true)
  }

  async function guardarHorario() {
    setGuardandoHorario(true)
    try {
      await onGuardarHorario(partido.id, horarioDraft)
      setEditandoHorario(false)
    } catch {
      // el error ya lo muestra el padre (errorGuardar) - se queda en modo edicion
    } finally {
      setGuardandoHorario(false)
    }
  }

  // El horario elegido tiene que ser uno permitido (ver restriccionHorario).
  const motivoHorarioDraft = motivoHorarioInvalido(horarioDraft, restriccionHorario)

  const jugado = partido.golesLocal != null
  // "En vivo": ya se armo la alineacion (se abrio Control de Partido)
  // pero todavia no se finalizo - el marcador que se ve viene de
  // golesLocalEnVivo/golesVisitanteEnVivo, que ControlPartido
  // actualiza solo cada vez que cambia un gol (ver
  // torneoPartidosService.actualizarMarcadorEnVivo). Prefill del
  // input con ese valor para no tener que retipearlo al finalizar.
  const enVivo = !jugado && (partido.titularesLocal?.length > 0 || partido.titularesVisitante?.length > 0)
  const golesLocal = form?.golesLocal ?? partido.golesLocal ?? (enVivo ? partido.golesLocalEnVivo ?? 0 : '')
  const golesVisitante = form?.golesVisitante ?? partido.golesVisitante ?? (enVivo ? partido.golesVisitanteEnVivo ?? 0 : '')
  const ganoLocal = jugado && partido.golesLocal > partido.golesVisitante
  const ganoVisitante = jugado && partido.golesVisitante > partido.golesLocal
  const nombreLocal = nombreEquipo(partido.equipoLocalId)
  const nombreVisitante = nombreEquipo(partido.equipoVisitanteId)

  return (
    <li
      className={`overflow-hidden rounded-2xl border border-l-4 bg-surface shadow-sm transition-colors ${
        jugado ? 'border-line border-l-success' : 'border-dashed border-line border-l-line'
      }`}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        {mostrarFecha ? (
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
            Fecha {partido.fechaNumero}
          </span>
        ) : jugado ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Jugado
          </span>
        ) : enVivo ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-danger">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
            {textoMinutoEnCurso(partido, ahora) || 'En vivo'}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-line" /> Pendiente
          </span>
        )}
        {partido.fase === FASE_LIGUILLA ? (
          <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">{etiquetaLiguilla(leg)}</span>
        ) : (
          <>
            {leg === 'ida' && (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Ida</span>
            )}
            {leg === 'vuelta' && (
              <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold">↩ Vuelta</span>
            )}
          </>
        )}
        <span className="flex-1" />
        {onAbrirControl && (
          <button
            onClick={() => onAbrirControl(partido)}
            disabled={Boolean(bloqueadoPor)}
            className="shrink-0 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft"
            title={
              bloqueadoPor
                ? `Terminá primero el partido de ${nombreEquipo(bloqueadoPor.equipoLocalId)} vs ${nombreEquipo(bloqueadoPor.equipoVisitanteId)} (Fecha ${bloqueadoPor.fechaNumero})`
                : 'Alineación y eventos del partido'
            }
          >
            📋 Control
          </button>
        )}
        {onCambiarFecha && (
          <button
            onClick={abrirCambioFecha}
            disabled={cambiandoFecha}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-brand-soft hover:text-brand disabled:opacity-50"
            title="Cambiar este partido de fecha"
          >
            {cambiandoFecha ? '…' : '🔀'}
          </button>
        )}
        <button
          onClick={() => onReiniciar(partido)}
          disabled={reiniciando}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-warning-soft hover:text-warning disabled:opacity-50"
          title="Reiniciar goles y tarjetas de este partido"
        >
          {reiniciando ? '…' : '↺'}
        </button>
        <button
          onClick={() => onEliminar(partido)}
          disabled={eliminando}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-ink-soft/60 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
          title="Eliminar partido"
        >
          {eliminando ? '…' : '×'}
        </button>
      </div>

      {editandoFecha && (
        <div className="flex items-center gap-1.5 px-3 pb-2">
          <span className="text-[11px] text-ink-soft">Mover a</span>
          <select
            value={fechaDraft}
            onChange={(e) => setFechaDraft(Number(e.target.value))}
            disabled={cambiandoFecha}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink outline-none focus-visible:border-brand disabled:opacity-50"
          >
            {opcionesFecha.map((f) => (
              <option key={f} value={f}>Fecha {f}</option>
            ))}
          </select>
          <button
            onClick={confirmarCambioFecha}
            disabled={cambiandoFecha}
            className="shrink-0 rounded-lg bg-brand px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
          >
            {cambiandoFecha ? '…' : 'Confirmar'}
          </button>
          <button
            onClick={() => setEditandoFecha(false)}
            disabled={cambiandoFecha}
            className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] text-ink-soft disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="px-3 pb-1">
        {editandoHorario ? (
          <div className="space-y-1.5">
            <SelectorFechaHora value={horarioDraft} onChange={setHorarioDraft} disabled={guardandoHorario} restriccion={restriccionHorario} />
            <div className="flex items-center gap-1.5">
              <button
                onClick={guardarHorario}
                disabled={guardandoHorario || Boolean(motivoHorarioDraft)}
                className="shrink-0 rounded-lg bg-brand px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                {guardandoHorario ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditandoHorario(false)}
                disabled={guardandoHorario}
                className="shrink-0 rounded-lg border border-line px-2 py-1 text-[11px] text-ink-soft disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={abrirEdicionHorario}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              partido.fecha ? 'bg-paper text-ink-soft hover:bg-line/40' : 'bg-brand-soft text-brand hover:bg-brand/20'
            }`}
          >
            {partido.fecha ? `🗓 ${formatearFechaProgramada(partido.fecha)}` : '+ Programar horario'}
          </button>
        )}
      </div>

      <div className="mx-3 mb-3 mt-1.5 overflow-hidden rounded-xl border border-line/70 bg-paper">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <EscudoEquipo nombre={nombreLocal} />
          <span
            className={`min-w-0 flex-1 break-words text-sm leading-tight ${
              ganoLocal ? 'font-bold text-ink' : ganoVisitante ? 'font-medium text-ink-soft' : 'font-medium text-ink'
            }`}
          >
            {nombreLocal}
          </span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={golesLocal}
            placeholder="–"
            onChange={(e) => onChange(partido.id, 'golesLocal', e.target.value)}
            className={`money h-10 w-14 shrink-0 rounded-lg border-2 text-center text-lg font-extrabold text-ink outline-none placeholder:text-ink-soft/30 focus-visible:border-brand ${
              jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface'
            }`}
          />
        </div>
        <div className="border-t border-line/70" />
        <div className="flex items-center gap-2.5 px-3 py-2">
          <EscudoEquipo nombre={nombreVisitante} />
          <span
            className={`min-w-0 flex-1 break-words text-sm leading-tight ${
              ganoVisitante ? 'font-bold text-ink' : ganoLocal ? 'font-medium text-ink-soft' : 'font-medium text-ink'
            }`}
          >
            {nombreVisitante}
          </span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={golesVisitante}
            placeholder="–"
            onChange={(e) => onChange(partido.id, 'golesVisitante', e.target.value)}
            className={`money h-10 w-14 shrink-0 rounded-lg border-2 text-center text-lg font-extrabold text-ink outline-none placeholder:text-ink-soft/30 focus-visible:border-brand ${
              jugado ? 'border-success/30 bg-success-soft' : enVivo ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface'
            }`}
          />
        </div>
      </div>

      {!ocultarBoton && (
        <div className="border-t border-line bg-paper px-3 py-2 text-right">
          {bloqueadoPor && (
            <p className="mb-1.5 text-left text-[11px] text-warning">
              ⚠ Terminá antes el partido de Fecha {bloqueadoPor.fechaNumero}
            </p>
          )}
          <button
            onClick={() => onGuardar(partido)}
            disabled={guardando || Boolean(bloqueadoPor)}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : jugado ? 'Corregir' : 'Guardar'}
          </button>
        </div>
      )}
    </li>
  )
}
