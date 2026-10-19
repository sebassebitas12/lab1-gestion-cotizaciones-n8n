# Reglas de negocio — Gestión de solicitudes de cotización

## Propósito

Automatizar la recepción de cotizaciones por correo, validar los datos, consultar el inventario, registrar cada resultado, analizar disponibilidad reciente y responder al solicitante.

## Clases y responsabilidades

### `Producto`

Representa un artículo del catálogo con identificador, nombre, existencias y precio unitario.

- `tieneStock(cantidad)`: devuelve `true` solo cuando la cantidad es un entero positivo y hay suficientes existencias.
- `calcularTotal(cantidad)`: multiplica el precio por una cantidad entera positiva; rechaza cantidades inválidas con `RangeError`.

### `SolicitudCotizacion`

Representa una solicitud recibida por correo.

- `extraerDatos()`: primero respeta los campos `Producto:` y `Cantidad:` existentes; si no los encuentra, interpreta frases cotidianas y reconoce alias del catálogo como "portátil" para laptop o "ratón" para mouse. Acepta cantidades en cifras o escritas con palabras y normaliza mayúsculas y tildes.
- `esValida()`: exige un producto identificado, una cantidad entera positiva y una sola interpretación posible.
- `determinarEstado(producto)`: devuelve `pendiente` si hay stock suficiente, `sin stock` si no alcanza y `rechazada` si el correo no se puede interpretar, el producto no existe o falla la consulta. Incluye un motivo que indica qué aclarar.
- Este escenario procesa un producto por correo. Si el mensaje contiene dos productos o cantidades contradictorias, el parser lo rechaza para pedir aclaración en vez de elegir un valor arbitrario.

### `HistorialTendencia`

Analiza cotizaciones previas del mismo producto y la solicitud actual.

- `determinarTendencia(producto, solicitudActual, errorHistorial)`: ordena las solicitudes válidas por fecha, toma las cuatro más recientes y compara dos periodos de dos solicitudes.
- El porcentaje de disponibilidad es la proporción de solicitudes con estado `pendiente`; `sin stock` representa falta de disponibilidad. Se excluyen solicitudes rechazadas.
- Devuelve `mejorando`, `empeorando` o `estable`, junto con los porcentajes de ambos periodos y un resumen. Con menos de cuatro solicitudes devuelve `datos insuficientes`; si no se puede consultar el servicio, devuelve `no disponible`.

## Reglas aplicadas

1. La comparación de nombres ignora mayúsculas y tildes.
2. La solicitud debe contener producto y cantidad.
3. La cantidad debe ser un entero positivo.
4. El producto debe existir en el catálogo.
5. Hay stock suficiente cuando `stock >= cantidad`.
6. Solo una solicitud `pendiente` tiene un total estimado; el sistema no calcula total para solicitudes sin stock.
7. La tendencia se basa en los estados guardados en `/solicitudes`; no altera la decisión actual ni el mensaje enviado al cliente.
8. DeepSeek produce una sugerencia interna opcional. JavaScript conserva el control sobre los valores comerciales.

## Flujo de datos en n8n

1. Gmail Trigger busca mensajes no leídos de la bandeja de entrada con términos comerciales de cotización, precio o disponibilidad, y evita procesar mensajes enviados desde la misma cuenta.
2. Un Code node limpia el cuerpo y las respuestas citadas, extrae remitente y asunto, identifica intención comercial y obtiene producto y cantidad desde lenguaje cotidiano. Si la solicitud es ambigua, incompleta o contradictoria, no consulta precios ni inventario.
3. Los mensajes válidos consultan `/productos`; otro Code node determina estado, motivo, disponibilidad y total estimado.
4. HTTP Request consulta `/solicitudes` para obtener el historial reciente del producto. El Code node siguiente ejecuta `HistorialTendencia` y agrega la conclusión al registro.
5. DeepSeek recibe solo los datos comerciales mínimos para preparar una sugerencia interna. Si falla, el registro y la respuesta al cliente siguen adelante.
6. JavaScript arma un correo formal con los valores calculados localmente; la tendencia queda como dato de análisis interno.
7. HTTP Request guarda la solicitud y su tendencia en `/solicitudes`. Después de guardar, Gmail marca el correo como leído y responde en el hilo original.

Los mensajes incompletos o ambiguos se registran como `rechazada` y reciben una pregunta de aclaración sin exigir etiquetas fijas. Los mensajes no relacionados con cotizaciones que coinciden con la búsqueda de Gmail se marcan como leídos y se ignoran para evitar reprocesarlos.

## Actualización del workflow

n8n no lee `clases.js` desde el disco. `generate_workflow.js` incorpora las clases en el JSON exportado. Después de modificar el código local, genera `n8n_workflow_escenario3_extension.json` e importa esa versión en n8n. Vuelve a asignar las credenciales si n8n las solicita.

