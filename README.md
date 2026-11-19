# Ocupación del club

Panel web público, sin identificación del centro ni detalles de su proveedor.

## Qué muestra

- **Situación actual:** última lectura, antigüedad, **tendencia respecto a hace unos 15 minutos**, media semanal, máximo y mínimo de hoy.
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

## Publicar con GitHub Pages

En **Settings > Pages > Build and deployment**, seleccionar **GitHub Actions** como origen. El workflow `.github/workflows/pages.yml` despliega el panel tras cambios visuales, del archivo mensual o de `latest.json`. El publicador escribe primero el CSV y después el JSON, por lo que el cambio del JSON activa **una única publicación por lectura**; no hacen falta dos despliegues por intervalo. El panel permanece en `https://bogar.github.io/ocupacion-club/`.

## Actualización de datos

La web no gestiona accesos ni consulta sistemas privados. Lee la última lectura del JSON, las series de datos del CSV reciente y los archivos mensuales publicados en este repositorio. El sistema que recopila las lecturas es independiente y debe publicar **únicamente** dos campos: `timestamp` en UTC e `people` como entero. No se deben publicar nombres de centros, URLs privadas, identificadores de sesión ni credenciales.

Si no hay lecturas, la página muestra un estado sin datos. Los colores del mapa de calor son **relativos al histórico disponible**, no porcentajes de aforo ni de capacidad máxima.

## Funcionamiento

Sitio estático sin dependencias, analíticas, cookies ni almacenamiento local. Todas las horas se muestran en la zona horaria `Europe/Madrid`.

## Frecuencia y estado

Se prevé una lectura cada 5 minutos desde un proceso externo. La web comprueba el CSV reciente cada minuto sin recargar la página y advierte si la lectura más reciente supera los 20 minutos de antigüedad. La publicación puede tener un pequeño retraso respecto de la toma de datos. El archivo `data/ocupacion.csv` contiene hasta 60 días de lecturas para que la consulta actual sea rápida. **Los meses anteriores se archivan permanentemente** en `data/archivo/AAAA-MM.csv` y se enumeran en `data/archivo/index.json`. El selector de histórico mensual permite consultarlos. El histórico íntegro se conserva adicionalmente en el sistema de recogida.

## Conservación del histórico

No se elimina ningún mes archivado automáticamente. Cada mes terminado se publica en un archivo CSV separado, con marcas temporales UTC y sin nombres de centros ni credenciales. El mes en curso está disponible en el CSV reciente y, una vez terminado, se crea su archivo permanente. El archivo de 60 días puede descartar lecturas antiguas porque estas ya se conservan en el archivo mensual correspondiente.


## Interpretación y rendimiento

Se trata de personas observadas en las consultas disponibles, **no** de porcentajes de aforo ni de estimaciones oficiales de capacidad. Las medias y máximos de los gráficos resumidos se refieren solamente a muestras reales del intervalo. Las franjas sin registros aparecen vacías. El mapa de calor utiliza una escala relativa al periodo, que puede cambiar de un mes a otro.

El panel no descarga todos los años a la vez: carga primero el CSV reciente (hasta 60 días) y después el archivo mensual seleccionado, si es necesario. Los gráficos agrupan cientos o miles de muestras en un número manejable de puntos, pero el CSV original del mes conserva cada lectura. La web refresca `latest.json` y el CSV reciente cada minuto, y el índice de meses cada cinco minutos. Si no está disponible el JSON, utiliza el último registro del CSV. No requiere base de datos, cookies, analítica ni almacenar datos en el navegador.

**Revisión de interfaz:** 19/11/2026. Para cualquier ajuste del sistema de captura, consultar el repositorio privado independiente.

## Tendencia de ocupación

La tarjeta principal compara la última lectura con el registro más cercano a 15 minutos antes (se admite una diferencia de hasta 5 minutos). Si hay referencias comparables, aparece una flecha con el cambio **absoluto de personas** y los minutos reales transcurridos. Las subidas se muestran en ámbar, las bajadas en verde y los valores sin cambio en azul. Si faltan lecturas para esa ventana, indica que la tendencia está pendiente en lugar de deducir una cifra inexacta. No se trata de una predicción.
