// Nombre y primer apellido, para listas angostas (Cancha, en
// ControlPartido y CanchaPublica) sin lugar para un nombre completo
// con segundo nombre y dos apellidos. Con nombres tipo "Luis Alberto
// Ortiz Jauregui" (nombre1 nombre2 apellido1 apellido2), el primer
// apellido es la anteultima palabra - la ultima es siempre el segundo
// apellido, que es el que sobra. Con 1 o 2 palabras no hay nada que
// acortar, se muestra tal cual.
export function nombreCorto(nombreCompleto) {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length <= 2) return partes.join(' ')
  return `${partes[0]} ${partes[partes.length - 2]}`
}
