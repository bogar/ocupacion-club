# Ocupación del club

Panel web público, sin identificación del centro ni detalles de su proveedor.

## Qué muestra

- **Situación actual:** última lectura, antigüedad, **tendencias independientes a 15, 30 y 60 minutos**, media semanal, máximo y mínimo de hoy.
- **Histórico navegable:** hoy, 7 días, 30 días y cualquier mes disponible en `data/archivo/index.json`.
- **Resumen del periodo elegido:** media, máximo, mínimo y número de días con observaciones.
- **Evolución legible a gran escala:** lecturas originales para hoy, agrupación horaria para 7 días y agrupación diaria para 30 días o un mes completo. Cada grupo muestra tanto la media como el máximo observado.
- **Perfil horario:** comparación de días laborables y fines de semana, sin incluir una categoría hasta tener al menos tres jornadas. Las medias se calculan por día primero, evitando dar más peso a las horas con más lecturas.
- **Mapa de calor semanal** y recomendaciones de horarios tranquilos basadas en al menos tres jornadas de datos por franja. Estas estadísticas usan los últimos 30 días, o el mes seleccionado.
- **Estado de actualización:** aviso si la última lectura supera 20 minutos o si falla la consulta de datos.

El panel utiliza el histórico reciente `data/ocupacion.csv`, con el formato:

```csv
timestamp,people
2026-11-19T16:43:51.470Z,312
```

La fila anterior es un **ejemplo de formato**. No es una lectura utilizada por el panel.

La lectura más reciente también se publica por separado en [`data/latest.json`](data/latest.json), con **solamente** dos campos:

```json
{
  "people": 391,
  "timestamp": "2026-11-19T18:40:27.219Z"
}
```

La fecha es UTC en formato ISO 8601. El archivo es accesible desde `https://bogar.github.io/ocupacion-club/data/latest.json` una vez desplegado Pages. No incluye el nombre del centro ni ningún identificador.

## Publicación de la web y de los datos

En **Settings > Pages > Build and deployment**, seleccionar **GitHub Actions** como origen. El workflow `.github/workflows/pages.yml` despliega el sitio **solo cuando cambian el código o el diseño**. La lectura más reciente se actualiza en GitHub sin reconstruir Pages.

La web solicita los CSV y JSON públicos directamente a `raw.githubusercontent.com/bogar/ocupacion-club/main/data/...` con una segunda opción al mismo dominio de Pages si el primero no está disponible. El CDN de GitHub puede introducir varios minutos de caché, por lo que la web siempre indica la antigüedad de la lectura, no promete inmediatez absoluta.

La dirección del panel permanece en `https://bogar.github.io/ocupacion-club/`.

## Actualización de datos

La web no gestiona accesos ni consulta sistemas privados. Lee la última lectura del JSON, la ventana móvil `data/live.csv`, el CSV de 60 días y los archivos mensuales publicados en este repositorio. El sistema que recopila las lecturas es independiente y debe publicar **únicamente** dos campos: `timestamp` en UTC e `people` como entero. No se deben publicar nombres de centros, URLs privadas, identificadores de sesión ni credenciales.

Si no hay lecturas, la página muestra un estado sin datos. Los colores del mapa de calor son **relativos al histórico disponible**, no porcentajes de aforo ni de capacidad máxima.

## Funcionamiento

Sitio estático sin dependencias, analíticas, cookies ni almacenamiento local. Todas las horas se muestran en la zona horaria `Europe/Madrid`.

## Frecuencia y estado

Se prevé una lectura cada 5 minutos desde un proceso externo. La web comprueba el CSV reciente cada minuto sin recargar la página y advierte si la lectura más reciente supera los 20 minutos de antigüedad. La publicación puede tener un pequeño retraso respecto de la toma de datos. El archivo `data/ocupacion.csv` contiene hasta 60 días de lecturas para que la consulta actual sea rápida. **Los meses anteriores se archivan permanentemente** en `data/archivo/AAAA-MM.csv` y se enumeran en `data/archivo/index.json`. El selector de histórico mensual permite consultarlos. El histórico íntegro se conserva adicionalmente en el sistema de recogida.

## Conservación del histórico

No se elimina ningún mes archivado automáticamente. Cada mes terminado se publica en un archivo CSV separado, con marcas temporales UTC y sin nombres de centros ni credenciales. El mes en curso está disponible en el CSV reciente y, una vez terminado, se crea su archivo permanente. El archivo de 60 días puede descartar lecturas antiguas porque estas ya se conservan en el archivo mensual correspondiente.


## Interpretación y rendimiento

Se trata de personas observadas en las consultas disponibles, **no** de porcentajes de aforo ni de estimaciones oficiales de capacidad. Las medias y máximos de los gráficos resumidos se refieren solamente a muestras reales del intervalo. Las franjas sin registros aparecen vacías. El mapa de calor utiliza una escala relativa al periodo, que puede cambiar de un mes a otro.

El panel no descarga todos los años a la vez: carga primero el CSV reciente (hasta 60 días) y después el archivo mensual seleccionado, si es necesario. Los gráficos agrupan cientos o miles de muestras en un número manejable de puntos, pero el CSV original del mes conserva cada lectura. La web refresca `latest.json`, `live.csv` y el CSV de 60 días cada minuto, y el índice de meses cada cinco minutos. Si no está disponible el JSON, utiliza el último registro del CSV. No requiere base de datos, cookies, analítica ni almacenar datos en el navegador.

**Revisión de interfaz:** 19/11/2026. Para cualquier ajuste del sistema de captura, consultar el repositorio privado independiente.

## Tendencias de ocupación

La tarjeta principal muestra tres indicadores compactos de **15 minutos, 30 minutos y 1 hora**. Cada comparación toma la lectura válida más cercana a ese intervalo respecto de la lectura más reciente. Los márgenes máximos permitidos son ±5, ±6 y ±7 minutos, respectivamente. La tarjeta indica el número absoluto de personas que han entrado o salido respecto de la referencia y el intervalo **real** transcurrido. Las subidas aparecen en ámbar, las bajadas en verde y la estabilidad en azul.

Si falta una lectura comparable, ese indicador muestra **Sin datos** sin afectar a los demás. Las referencias se calculan en el navegador a partir de los CSV públicos ya disponibles, por lo que no es necesario modificar Proxmox ni aumentar las consultas o publicaciones. Las tres comparaciones son tendencias observadas, no predicciones.

## Nuevos paneles inteligentes

- **Últimas dos horas**: curva de lecturas observadas en la tarjeta principal, con interrupciones visibles cuando faltan registros.
- **Comparación con lo habitual**: la lectura actual se compara con la media de la misma hora y día de la semana de otros días. Se necesitan **al menos tres jornadas** de referencia; el día actual no se utiliza para calcular la media.
- **Próximas horas**: hasta cuatro estimaciones basadas en esa misma combinación de día y hora, solo cuando existen al menos tres jornadas comparables. No son mediciones ni predicciones garantizadas.
- **Meses anteriores**: `data/archivo/resumen.json` permite mostrar la media mensual de hasta 12 meses cerrados, con avisos de cobertura baja. Cada media mensual se obtiene promediando las medias de los días observados.

## Optimización del publicador

El LXC realiza una recogida cada cinco minutos y, mediante la API Git Data, publica `data/latest.json` y `data/live.csv` en **un solo commit**. `live.csv` contiene las últimas 26 horas y cubre la transición entre días. `data/ocupacion.csv` se renueva aproximadamente **una vez al día**, conservando la ventana de 60 días. Los meses cerrados se archivan definitivamente en `data/archivo/`. La copia original completa permanece sin recorte en Proxmox.

El navegador fusiona `data/live.csv` con `data/ocupacion.csv` por timestamp para evitar duplicados. GitHub Pages se construye solo cuando cambia la interfaz, no con cada lectura nueva. Estas medidas reducen considerablemente los archivos reescritos y el consumo de compilaciones.

## Optimización de carga (versión actual)

- **Arranque por etapas:** se solicita primero `data/latest.json` para mostrar inmediatamente la ocupación; después `data/live.csv` para las tendencias y las dos últimas horas.
- **Histórico bajo demanda:** el CSV de 60 días se descarga en segundo plano al usar la vista completa y se vuelve a comprobar cada hora, no cada minuto.
- **Gráficos diferidos:** Chart.js se descarga solo en vista completa, después de consultar la ocupación. Las fechas ya convertidas se reutilizan en memoria al calcular estadísticas.
- **Vista rápida:** botón en la cabecera. Oculta análisis históricos y muestra únicamente ocupación, tendencias y gráfico de las últimas dos horas. La elección se guarda en el navegador (solo esta preferencia).
- **Caché segura:** para `latest.json` y `live.csv` nunca se utiliza como respaldo la copia del último despliegue de GitHub Pages, que podría estar obsoleta. Si falla la red se conserva la hora conocida y aparece el estado de error, sin fingir que es una lectura actual.

La vista completa sigue incluyendo el historial, el mapa de calor, la comparativa mensual y las recomendaciones.


## Tarjeta compacta para Home Assistant

La URL `https://bogar.github.io/ocupacion-club/assets/ha.html` muestra solamente la ocupación actual y la antigüedad de la última lectura, adecuada para una tarjeta tipo iframe. Consulta **`data/latest.json` directamente a través de `raw.githubusercontent.com`**, no el CSV de 60 días, que solo se actualiza diariamente.

La tarjeta se refresca cada minuto y también cuando vuelve a estar visible. Si una lectura tiene más de 20 minutos, muestra un guion y el aviso **Datos desactualizados**, en lugar de presentar la cifra como actual. Si falla la conexión, informa **Sin datos recientes**. No se necesitan cambios en el contenedor Proxmox para esta tarjeta.


## Consultas nocturnas y ocupación estimada

Entre las **23:00 y las 05:30 (Europe/Madrid)** se consulta la fuente cada **15 minutos**; de **05:35 a 22:55**, cada **5 minutos**.

Si se obtiene el dato, se publica como medición real. Si la ficha está disponible pero carece del indicador de ocupación, se publica **0 estimado** y el archivo `data/reading-status.json` contiene `mode: "estimated_missing"`. Los ceros estimados no se guardan en los CSV de lecturas reales ni participan en sus estadísticas.

Los fallos técnicos de acceso o navegación no se convierten en cero. Tanto el panel principal como `assets/ha.html` distinguen explícitamente una **ocupación no publicada** de una medición real.

`data/latest.json` conserva únicamente `people` y `timestamp`, sin nombre ni identificador del centro.

## Desglose apilado estimado en el histórico

El gráfico «Evolución de la ocupación» ofrece un botón para mostrar **desglose apilado** de actividades dirigidas, tenis, esquaix y frontón, cuando existan datos **agregados y validados** en `data/desglose.json`. La línea total sigue mostrando la ocupación **real** del club. Las categorías son **estimaciones de personas equivalentes**, nunca mediciones directas de asistentes por zona.

Por defecto, `data/desglose.json` está vacío y la gráfica muestra únicamente las lecturas reales. Ninguna estimación se inventa, no se publican profesores, horarios de clases individuales ni IDs. El residual `sin atribuir` es una diferencia matemática, no «personas en fitness». Las modalidades Tennis Individual y Tennis Dobles usan las **mismas pistas**, que no deben duplicarse.

Detalles del modelo, esquema y controles: [Documentación del desglose](docs/desglose.md). El exportador experimental se encuentra en el repositorio privado y **nunca publica automáticamente**.

## Elegir un día concreto

El gráfico **Evolución de la ocupación** incluye un selector **Día** (calendario) además de Hoy, 7 días, 30 días y Mes. Al seleccionar una fecha, muestra **cada lectura real de ese día**, con las horas de Madrid y el resumen de media, máximo y mínimo correspondiente. El botón **Limpiar** vuelve a Hoy.

Si la fecha no figura en el CSV reciente, el panel carga bajo demanda el CSV archivado del mes seleccionado. No descarga todos los meses ni permite elegir una fecha futura. Un día sin lecturas presenta un mensaje claro en lugar de una curva inventada.

El filtro de día se aplica al gráfico histórico y a su resumen de período. Los análisis de patrones generales siguen usando su propia ventana de datos. El filtro también funciona en modo desglose apilado si hay estimaciones para ese día. Pruebas: `node --test test/day-filter.test.js`.
