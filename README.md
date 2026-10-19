# Laboratorio 1 — Escenario 3

## Propósito

El flujo recibe solicitudes de cotización por Gmail, identifica producto y cantidad, consulta el inventario de JSON Server, determina disponibilidad y precio, registra la solicitud y responde en el mismo hilo. La lógica de negocio es JavaScript determinista. DeepSeek aporta una sugerencia interna y no decide el precio ni el estado comercial.

## Archivos del proyecto

- `clases.js`: clases `Producto`, `SolicitudCotizacion` e `HistorialTendencia`. Es la fuente de la lógica de negocio.
- `main.js`: demuestra localmente los cuatro casos principales y un ejemplo de tendencia. Se ejecuta con `node main.js`.
- `db.json`: base de datos de JSON Server, con catálogo de productos y solicitudes guardadas. n8n consulta el servicio JSON Server; no lee este archivo directamente.
- `generate_workflow.js`: inserta el código actual de las clases en los Code nodes y genera el archivo importable.
- `n8n_workflow_escenario3.json`: exportación del workflow de la parte 1.
- `n8n_workflow_escenario3_extension.json`: exportación actualizada con la extensión de historial y tendencia.
- `logica_negocio_escenario3.md`: reglas y recorrido del proceso.

## Extensión elegida: historial y tendencia (Reto 4)

El flujo aprovecha el historial que ya se registra en `/solicitudes`. Para cada cotización válida, consulta las solicitudes recientes del mismo producto y usa la clase `HistorialTendencia` para comparar la disponibilidad observada en los dos periodos más recientes:

1. Toma las cuatro cotizaciones válidas más recientes del producto.
2. Compara las dos anteriores con las dos más recientes.
3. Calcula en cada periodo el porcentaje de cotizaciones que tuvieron stock suficiente (`pendiente`). Las solicitudes `sin stock` cuentan como falta de disponibilidad; las rechazadas se excluyen.
4. Guarda `estadoTendencia`, `porcentajeAnterior`, `porcentajeReciente`, `solicitudesAnalizadas` y `resumenTendencia` junto con la solicitud.

La tendencia puede resultar `mejorando`, `empeorando` o `estable`. Si aún no hay cuatro solicitudes válidas del mismo producto, el resultado indica `datos insuficientes`. Si JSON Server no permite consultar el historial, indica `no disponible` y el flujo sigue con la cotización.

Este indicador es informativo: no cambia el precio, el estado actual ni el correo que recibe el cliente. El historial se guarda en la colección existente; no hace falta agregar una base de datos nueva.

### Ejemplo para presentar la tendencia

Envía cuatro solicitudes del mismo producto en este orden: dos con cantidad superior a las existencias para obtener `sin stock`, y después dos con una cantidad que sí tenga existencias. En la cuarta ejecución, el registro debe mostrar una tendencia `mejorando` con porcentajes comparables. Espera a que cada correo termine de procesarse antes de enviar el siguiente para mantener el orden del historial.

## Recorrido del workflow

Gmail Trigger → Extraer datos del correo → identificar y validar la solicitud → consultar productos → determinar estado, motivo y total → consultar historial reciente → analizar tendencia → crear sugerencia interna con DeepSeek → combinar resultados → guardar en `/solicitudes` → marcar el correo como leído → responder al remitente en el hilo original.

El lector acepta solicitudes escritas con lenguaje cotidiano, por ejemplo: "Quisiera cotizar dos teclados" o "Cuánto cuesta una laptop?". Reconoce nombres habituales del catálogo, cantidades numéricas o expresadas con palabras y variantes con o sin tildes. Si faltan datos o el correo menciona productos o cantidades contradictorios, no adivina: registra la solicitud como rechazada y pide una aclaración en lenguaje natural. Este escenario cotiza un producto por correo; si el cliente menciona varios, el flujo pide que aclare cuál desea. Los productos fuera del catálogo se identifican y reciben una respuesta para confirmar el nombre o modelo. Los mensajes que coinciden con la búsqueda comercial de Gmail pero no parecen solicitudes se marcan como leídos para evitar reprocesarlos.

Para usarlo con una bandeja compartida en producción, conviene filtrar Gmail con una etiqueta o un alias dedicado a ventas: la búsqueda por palabras comerciales puede coincidir con mensajes que no son solicitudes y esos mensajes se marcan como leídos.

## Generar e importar la versión actualizada

Desde esta carpeta ejecuta:

```powershell
node generate_workflow.js
```

Después, importa `n8n_workflow_escenario3_extension.json` en n8n y asigna las credenciales OAuth de Gmail y Header Auth de DeepSeek a los nodos correspondientes. Revisa la URL de JSON Server y publica el workflow actualizado. Si n8n corre dentro de Docker, `localhost` puede apuntar al contenedor; en ese caso genera el JSON con una dirección accesible desde el contenedor:

```powershell
$env:JSON_SERVER_BASE_URL = 'http://host.docker.internal:3000'
node generate_workflow.js
```

El archivo exportado no contiene las credenciales.

## Casos locales incluidos

`main.js` conserva cuatro escenarios, redactados como correos normales en lugar de una plantilla rígida:

- Solicitud de dos laptops: `pendiente` con total de ejemplo CRC 1 700 000.
- Consulta por un mouse: `sin stock`.
- Solicitud de impresoras 3D: producto identificado, pero rechazada porque no figura en este catálogo didáctico.
- Consulta incompleta: se rechaza con un motivo claro y se solicita aclaración.
- Ejemplo de historial: compara cuatro cotizaciones de laptop y muestra una mejora de disponibilidad.

Los alias del parser corresponden al catálogo académico actual. Para incorporar la idea al negocio Vértice habrá que adaptar los campos a impresión 3D y conservar la revisión humana de cotizaciones; los productos y precios de ejemplo no se trasladan al repositorio.

Ejecuta la demostración local con `node main.js`. La ejecución de n8n requiere el workflow importado, las credenciales asignadas y JSON Server disponible.

## Evidencia incluida

La carpeta `capturas/` documenta el workflow publicado, una ejecución donde se observa el análisis de tendencia y las respuestas para un producto disponible y otro sin existencias. Las direcciones personales se ocultaron en las copias de entrega; los originales permanecen intactos fuera de este paquete.

El `db.json` de esta entrega contiene solo el catálogo de ejemplo y `solicitudes: []`. No incluye los correos ni los registros generados durante las pruebas.

