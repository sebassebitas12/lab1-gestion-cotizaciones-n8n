function normalizarNombre(texto) {
  return String(texto || '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function limpiarTextoCorreo(texto) {
  const cuerpo = String(texto || '')
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, ' ')
    .replace(/<div\b[^>]*class=["'][^"']*gmail_quote[^"']*["'][^>]*>[\s\S]*$/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r\n?/g, '\n');

  const lineas = cuerpo.split('\n');
  const mensajeNuevo = [];

  for (const linea of lineas) {
    if (/^\s*(?:on .+ wrote:|el .+ escribio:|[-_]{2,}\s*(?:original message|mensaje original)\s*[-_]{2,})\s*$/.test(normalizarNombre(linea))) {
      break;
    }
    if (/^\s*>/.test(linea)) continue;
    mensajeNuevo.push(linea);
  }

  return mensajeNuevo.join('\n').trim();
}

const ALIAS_PRODUCTOS = {
  laptop: [
    'laptop', 'laptops', 'portatil', 'portatiles',
    'computadora portatil', 'computadoras portatiles', 'notebook', 'notebooks'
  ],
  mouse: ['mouse', 'mouses', 'raton', 'ratones'],
  teclado: ['teclado', 'teclados', 'keyboard', 'keyboards'],
  monitor: ['monitor', 'monitores', 'pantalla', 'pantallas', 'display', 'displays']
};

const NUMEROS_PALABRAS = {
  cero: 0,
  un: 1, uno: 1, una: 1,
  one: 1, a: 1, an: 1,
  dos: 2, two: 2,
  tres: 3, three: 3,
  cuatro: 4, four: 4,
  cinco: 5, five: 5,
  seis: 6, six: 6,
  siete: 7, seven: 7,
  ocho: 8, eight: 8,
  nueve: 9, nine: 9,
  diez: 10, ten: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20,
  veintiuno: 21, veintiun: 21, veintiuna: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29
};

const DECENAS_PALABRAS = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90
};

const UNIDADES_PALABRAS = {
  uno: 1, un: 1, una: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9
};

const PALABRAS_NUMERO_REGEX = Object.keys(NUMEROS_PALABRAS)
  .sort((a, b) => b.length - a.length)
  .map((palabra) => palabra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const PATRON_DECENA_Y_UNIDAD = '(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\\s+y\\s+(?:uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)';
const PATRON_NUMERO = '(?:\\d{1,5}|' + PATRON_DECENA_Y_UNIDAD + '|' + PALABRAS_NUMERO_REGEX.join('|') + ')';

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsearCantidad(valor) {
  const texto = normalizarNombre(valor).replace(/\s+/g, ' ').trim();
  if (/^\d{1,5}$/.test(texto)) {
    const numero = Number(texto);
    return Number.isSafeInteger(numero) ? numero : null;
  }

  if (Object.prototype.hasOwnProperty.call(NUMEROS_PALABRAS, texto)) {
    return NUMEROS_PALABRAS[texto];
  }

  const partes = texto.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(uno|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)$/);
  if (partes) {
    return DECENAS_PALABRAS[partes[1]] + UNIDADES_PALABRAS[partes[2]];
  }

  return null;
}

function buscarMencionesCatalogo(texto) {
  const menciones = [];

  for (const [producto, alias] of Object.entries(ALIAS_PRODUCTOS)) {
    const aliasOrdenados = [...alias].sort((a, b) => b.length - a.length);
    for (const nombre of aliasOrdenados) {
      const aliasNormalizado = normalizarNombre(nombre).replace(/\s+/g, ' ');
      const patron = aliasNormalizado
        .split(' ')
        .map(escaparRegex)
        .join('\\s+');
      const regex = new RegExp('(^|[^a-z0-9])(' + patron + ')(?=$|[^a-z0-9])', 'gi');
      let coincidencia;

      while ((coincidencia = regex.exec(texto)) !== null) {
        const inicio = coincidencia.index + coincidencia[1].length;
        menciones.push({
          producto,
          alias: nombre,
          inicio,
          fin: inicio + coincidencia[2].length
        });
      }
    }
  }

  const unicas = new Map();
  for (const mencion of menciones) {
    const clave = mencion.producto + ':' + mencion.inicio + ':' + mencion.fin;
    if (!unicas.has(clave)) unicas.set(clave, mencion);
  }

  return [...unicas.values()].sort((a, b) => a.inicio - b.inicio);
}

function cantidadesCercanas(texto, mencion) {
  const prefijo = texto.slice(Math.max(0, mencion.inicio - 80), mencion.inicio);
  const sufijo = texto.slice(mencion.fin, mencion.fin + 40);
  const cantidades = [];
  const regexAntes = new RegExp(
    '(?:^|[^a-z0-9])(' + PATRON_NUMERO + ')(?:\\s*(?:unidades?|unid\\.?|uds?\\.?|x)\\s*(?:de|del)?\\s*)?(?:un|una)?\\s*$',
    'i'
  );
  const regexDespues = new RegExp(
    '^\\s*(?:[,;:]\\s*)?(?:(?:x|por|cantidad(?:\\s+de)?|unidades?\\s+de)\\s*)(' + PATRON_NUMERO + ')(?![.,]\\d)\\b',
    'i'
  );
  const antes = prefijo.match(regexAntes);
  const despues = sufijo.match(regexDespues);

  if (antes) {
    const inicioCantidad = antes.index + antes[0].indexOf(antes[1]);
    const textoAntesCantidad = prefijo.slice(0, inicioCantidad);
    const precedeUnPrecio = /\b(?:precio|coste?|costo|presupuesto|total)(?:\s+(?:unitario|estimado))?\s*(?:de|:)?\s*$/i.test(textoAntesCantidad);
    if (!precedeUnPrecio) cantidades.push(parsearCantidad(antes[1]));
  }
  if (despues) cantidades.push(parsearCantidad(despues[1]));


  return cantidades.filter((cantidad) => Number.isSafeInteger(cantidad));
}

function extraerProductoGenerico(texto) {
  const cantidadOpcional = '(?:(' + PATRON_NUMERO + ')\\s*(?:(?:unidades?|unid\\.?|uds?\\.?)\\s*(?:de\\s+)?)?)?';
  const colaProducto = '([a-z0-9][a-z0-9\\s-]{1,60}?)(?=$|[,;.!?\\n])';
  const patrones = [
    new RegExp('\\b(?:producto|articulo|modelo)\\s*(?::|es|de)?\\s*' + cantidadOpcional + '(?:(?:unidades?\\s+de)\\s*)?' + colaProducto, 'i'),
    new RegExp('\\b(?:quisiera|quiero|necesito|busco|solicito|cotizar|cotizacion|precio|costo|presupuesto|disponibilidad)\\s+(?:(?:cotizar|comprar|adquirir|consultar|cotizacion|precio|costo|presupuesto|disponibilidad)\\s+)*(?:(?:de|para|por|del)\\s+)?' + cantidadOpcional + '(?:(?:unidades?\\s+de)\\s*)?(?:(?:el|la|un|una)\\s+)?' + colaProducto, 'i')
  ];

  for (const regex of patrones) {
    const coincidencia = texto.match(regex);
    if (!coincidencia) continue;
    let producto = coincidencia[2] || '';
    const sufijoContextual = new RegExp('\\s+para\\s+(?:(?:mi|su|la|el|los|las)\\s+)?(?:oficina|casa|negocio|uso|entrega)\\b.*$', 'i');
    const cierreCortesia = new RegExp('\\s+(?:por favor|porfa|muchas gracias|gracias)\\b.*$', 'i');
    const cambioDeTema = new RegExp('\\s+(?:y\\s+)?(?:me gustaria|quisiera|necesito|quiero|busco|solicito)\\b.*$', 'i');
    producto = producto.replace(sufijoContextual, '').replace(cierreCortesia, '').replace(cambioDeTema, '').trim();
    if (!producto || /^(?:cotizacion(?:es)?|cotizar|precio|precios|costo|costos|presupuesto|disponibilidad|stock|existencia|existencias|algo|producto|articulo|equipo)$/i.test(producto)) continue;
    if (!producto) continue;

    return {
      producto,
      cantidad: coincidencia[1] ? parsearCantidad(coincidencia[1]) : null
    };
  }

  return null;
}
class Producto {
  constructor(id, nombre, stock, precio) {
    this.id = id;
    this.nombre = nombre;
    this.stock = stock;
    this.precio = precio;
  }

  tieneStock(cantidad) {
    return Number.isSafeInteger(cantidad) && cantidad > 0 &&
      Number.isFinite(this.stock) && this.stock >= cantidad;
  }

  calcularTotal(cantidad) {
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
      throw new RangeError('La cantidad debe ser un entero positivo.');
    }
    return this.precio * cantidad;
  }
}

class SolicitudCotizacion {
  constructor(remitente, textoCorreo) {
    this.remitente = remitente;
    this.textoCorreo = textoCorreo;
  }

  extraerDatos() {
    const textoOriginal = limpiarTextoCorreo(this.textoCorreo);
    const texto = normalizarNombre(textoOriginal).replace(/\s+/g, ' ');
    const etiquetaProducto = texto.match(/\bproducto\s*:\s*(.+?)(?=\s*(?:\/|;|\b(?:cantidad|cant\.?|qty)\s*:)|[.;]|$)/i);
    const patronCantidadEtiqueta = new RegExp(
      '\\b(?:cantidad|cant\\.?|qty)\\s*:?\\s*(' + PATRON_NUMERO + ')(?![\\d.,]\\d)\\s*(?:unidades?|unid\\.?|uds?\\.?)?(?=$|[\\s,;.])',
      'i'
    );
    const cantidadEtiquetada = texto.match(patronCantidadEtiqueta);
    const cantidadExplicita = cantidadEtiquetada
      ? parsearCantidad(cantidadEtiquetada[1])
      : null;

    if (etiquetaProducto) {
      const producto = normalizarNombre(etiquetaProducto[1]).trim();
      return {
        producto,
        cantidad: cantidadExplicita,
        ambiguo: false,
        motivoExtraccion: !producto
          ? 'No se identific\u00f3 el producto solicitado.'
          : (!Number.isSafeInteger(cantidadExplicita) || cantidadExplicita <= 0
            ? 'La cantidad debe ser un entero positivo.'
            : '')
      };
    }

    const menciones = buscarMencionesCatalogo(texto);
    const productosMencionados = [...new Set(menciones.map((mencion) => mencion.producto))];

    if (productosMencionados.length > 1) {
      return {
        producto: '',
        cantidad: cantidadExplicita,
        ambiguo: true,
        motivoExtraccion: 'El correo menciona mÃ¡s de un producto y hace falta confirmar cuÃ¡l desea cotizar.'
      };
    }

    let producto = productosMencionados[0] || '';
    let cantidad = cantidadExplicita;

    if (producto) {
      const cantidadesDetectadas = menciones
        .filter((mencion) => mencion.producto === producto)
        .flatMap((mencion) => cantidadesCercanas(texto, mencion));
      const cantidadesUnicas = [...new Set(cantidadesDetectadas)];
      if (cantidad !== null) cantidadesUnicas.push(cantidad);
      const valoresCantidad = [...new Set(cantidadesUnicas)];

      if (valoresCantidad.length > 1) {
        return {
          producto,
          cantidad: null,
          ambiguo: true,
          motivoExtraccion: 'El correo contiene cantidades distintas; hace falta confirmar cuÃ¡ntas unidades desea.'
        };
      }
      cantidad = valoresCantidad.length === 1 ? valoresCantidad[0] : null;
    } else {
      const generico = extraerProductoGenerico(texto);
      if (generico) {
        producto = normalizarNombre(generico.producto);
        if (cantidad === null) cantidad = generico.cantidad;
      }
    }

    const motivoExtraccion = !producto
      ? 'No se identific\u00f3 el producto solicitado.'
      : (!Number.isSafeInteger(cantidad) || cantidad <= 0
        ? 'La cantidad debe ser un entero positivo.'
        : '');

    return { producto, cantidad, ambiguo: false, motivoExtraccion };
  }

  esValida() {
    const { producto, cantidad, ambiguo } = this.extraerDatos();
    return !ambiguo && producto.length > 0 &&
      Number.isSafeInteger(cantidad) &&
      cantidad > 0;
  }

  determinarEstado(producto, servicioError = null) {
    if (!this.esValida()) {
      const datos = this.extraerDatos();
      return {
        estado: 'rechazada',
        motivo: datos.motivoExtraccion || 'La solicitud no es v?lida.'
      };
    }

    if (servicioError) {
      return {
        estado: 'rechazada',
        motivo: 'No se pudo consultar el inventario: ' + String(servicioError)
      };
    }

    if (producto === null || producto === undefined) {
      return {
        estado: 'rechazada',
        motivo: 'El producto solicitado no existe en el catÃ¡logo.'
      };
    }

    const { cantidad } = this.extraerDatos();
    if (producto.tieneStock(cantidad)) {
      return {
        estado: 'pendiente',
        motivo: 'Hay stock suficiente para ' + cantidad + ' unidad(es).'
      };
    }

    return {
      estado: 'sin stock',
      motivo: 'Stock insuficiente para ' + cantidad + ' unidad(es).'
    };
  }
}

class HistorialTendencia {
  constructor(historial = []) {
    this.historial = Array.isArray(historial) ? historial : [];
  }

  determinarTendencia(producto, solicitudActual, errorHistorial = null) {
    const nombreProducto = normalizarNombre(producto);
    const base = {
      estadoTendencia: 'datos insuficientes',
      porcentajeAnterior: null,
      porcentajeReciente: null,
      solicitudesAnalizadas: 0,
      resumenTendencia: ''
    };

    if (errorHistorial) {
      return {
        ...base,
        estadoTendencia: 'no disponible',
        resumenTendencia: 'No se pudo consultar el historial: ' + String(errorHistorial)
      };
    }

    const registros = [...this.historial, solicitudActual]
      .filter((registro) => registro &&
        normalizarNombre(registro.producto) === nombreProducto &&
        ['pendiente', 'sin stock'].includes(registro.estado) &&
        Number.isFinite(Date.parse(registro.fechaSolicitud || '')))
      .map((registro) => ({
        estado: registro.estado,
        fecha: Date.parse(registro.fechaSolicitud)
      }))
      .sort((a, b) => a.fecha - b.fecha)
      .slice(-4);

    base.solicitudesAnalizadas = registros.length;
    if (registros.length < 4) {
      return {
        ...base,
        resumenTendencia: 'Se requieren 4 cotizaciones vÃ¡lidas del mismo producto para comparar dos periodos; hay ' + registros.length + '.'
      };
    }

    const periodoAnterior = registros.slice(0, 2);
    const periodoReciente = registros.slice(2, 4);
    const tasaDisponibilidad = (periodo) => Math.round(
      periodo.filter((registro) => registro.estado === 'pendiente').length /
        periodo.length * 100
    );
    const porcentajeAnterior = tasaDisponibilidad(periodoAnterior);
    const porcentajeReciente = tasaDisponibilidad(periodoReciente);
    let estadoTendencia = 'estable';

    if (porcentajeReciente > porcentajeAnterior) {
      estadoTendencia = 'mejorando';
    } else if (porcentajeReciente < porcentajeAnterior) {
      estadoTendencia = 'empeorando';
    }

    return {
      estadoTendencia,
      porcentajeAnterior,
      porcentajeReciente,
      solicitudesAnalizadas: registros.length,
      resumenTendencia: 'Disponibilidad de ' + nombreProducto + ': ' +
        porcentajeAnterior + '% en las 2 cotizaciones anteriores y ' +
        porcentajeReciente + '% en las 2 mÃ¡s recientes; tendencia ' +
        estadoTendencia + '.'
    };
  }
}

module.exports = {
  Producto,
  SolicitudCotizacion,
  HistorialTendencia,
  normalizarNombre
};

