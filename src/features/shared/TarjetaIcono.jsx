// Tarjeta amarilla o roja dibujada con CSS. Los emoji 🟨 y 🟥 no existen
// en las fuentes de Windows 10 (y otras) y se ven como un cuadradito
// vacio, asi que en vez de ellos se usa esto: se ve igual en cualquier
// dispositivo. `className` da el tamaño (por defecto, el de una tarjeta
// dentro de un texto); `tipo` es 'amarilla' o 'roja'.
export function TarjetaIcono({ tipo, className = 'h-3.5 w-2.5' }) {
  const esRoja = tipo === 'roja'
  return (
    <span
      role="img"
      aria-label={esRoja ? 'Tarjeta roja' : 'Tarjeta amarilla'}
      className={`inline-block shrink-0 rounded-[2px] border align-middle shadow-sm ${
        esRoja ? 'border-[#8f1a14] bg-[#e0352b]' : 'border-[#b8860b] bg-[#f6c90e]'
      } ${className}`}
    />
  )
}
