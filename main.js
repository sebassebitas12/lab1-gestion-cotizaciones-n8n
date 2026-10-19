const fs = require('node:fs');
const path = require('node:path');
const {
  Producto,
  SolicitudCotizacion,
  HistorialTendencia,
  normalizarNombre
} = require('./clases');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
const productos = db.productos.map(
  ({ id, nombre, stock, precio }) => new Producto(id, nombre, stock, precio)
);

const casos = [
  {
    nombre: 'Solicitud natural con stock',
    remitente: 'ana@example.com',
    correo: 'Buenos d\u00edas. Quisiera cotizar dos laptops para el trabajo. Por favor, confirmen precio y disponibilidad.'
  },
  {
    nombre: 'Solicitud natural sin stock',
    remitente: 'bruno@example.com',
    correo: 'Buenas tardes, \u00bfpodr\u00edan cotizar un mouse para mi oficina? Gracias.'
  },
  {
    nombre: 'Producto no incluido en catalogo',
    remitente: 'carla@example.com',
    correo: 'Hola, necesito cotizar dos impresoras 3D para mi negocio. \u00bfMe indican si las manejan?'
  },
  {
    nombre: 'Correo incompleto o ambiguo',
    remitente: 'diego@example.com',
    correo: 'Hola, quisiera una cotizaci\u00f3n para mi oficina. \u00bfMe pueden ayudar?'
  }
];

for (const datos of casos) {
  const solicitud = new SolicitudCotizacion(datos.remitente, datos.correo);
  const extraidos = solicitud.extraerDatos();
  const producto = productos.find(
    (item) => normalizarNombre(item.nombre) === extraidos.producto
  ) || null;
  const resultado = solicitud.determinarEstado(producto);
  const totalEstimado = resultado.estado === 'pendiente'
    ? producto.calcularTotal(extraidos.cantidad)
    : null;

  console.log(JSON.stringify({
    caso: datos.nombre,
    remitente: solicitud.remitente,
    datos: extraidos,
    ...resultado,
    totalEstimado
  }, null, 2));
}

const historialDemo = [
  { producto: 'laptop', estado: 'sin stock', fechaSolicitud: '2026-10-16T09:00:00.000Z' },
  { producto: 'laptop', estado: 'sin stock', fechaSolicitud: '2026-10-17T09:00:00.000Z' },
  { producto: 'laptop', estado: 'pendiente', fechaSolicitud: '2026-10-18T09:00:00.000Z' }
];
const solicitudActualDemo = {
  producto: 'laptop',
  estado: 'pendiente',
  fechaSolicitud: '2026-10-19T09:00:00.000Z'
};
const tendenciaDemo = new HistorialTendencia(historialDemo)
  .determinarTendencia('laptop', solicitudActualDemo);

console.log(JSON.stringify({
  caso: 'Ejemplo de tendencia con cuatro cotizaciones',
  ...tendenciaDemo
}, null, 2));

