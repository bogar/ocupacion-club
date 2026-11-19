# Ocupación del club

Panel web público, sin identificación del centro ni detalles de su proveedor.

## Qué muestra

- Última lectura de ocupación y su antigüedad.
- Evolución de hoy, últimos 7 días, últimos 30 días y consulta por mes de cualquier histórico archivado.
- Mapa de calor por día de la semana y hora.
- Resumen de franjas habituales cuando haya suficiente histórico.

El panel utiliza únicamente `data/ocupacion.csv`, con el formato:

```csv
timestamp,people
2026-11-19T16:43:51.470Z,312
```

La fila anterior es un **ejemplo de formato**. No es una lectura utilizada por el panel.

## Publicar con GitHub Pages

En **Settings > Pages > Build and deployment**, seleccionar **GitHub Actions** como origen. El workflow `.github/workflows/pages.yml` despliega el panel tras cada modificación del CSV o de los archivos de la web, incluso cuando haya doce actualizaciones por hora. El panel permanece en `https://bogar.github.io/ocupacion-club/`.

## Actualización de datos

La web no gestiona accesos ni consulta sistemas privados. Lee el CSV reciente y los archivos mensuales publicados en este repositorio. El sistema que recopila las lecturas es independiente y debe publicar **únicamente** dos campos: `timestamp` en UTC e `people` como entero. No se deben publicar nombres de centros, URLs privadas, identificadores de sesión ni credenciales.

Si no hay lecturas, la página muestra un estado sin datos. Los colores del mapa de calor son **relativos al histórico disponible**, no porcentajes de aforo ni de capacidad máxima.

## Funcionamiento

Sitio estático sin dependencias, analíticas, cookies ni almacenamiento local. Todas las horas se muestran en la zona horaria `Europe/Madrid`.

## Frecuencia y estado

Se prevé una lectura cada 5 minutos desde un proceso externo. La web comprueba el CSV reciente cada minuto sin recargar la página y advierte si la lectura más reciente supera los 20 minutos de antigüedad. La publicación puede tener un pequeño retraso respecto de la toma de datos. El archivo `data/ocupacion.csv` contiene hasta 60 días de lecturas para que la consulta actual sea rápida. **Los meses anteriores se archivan permanentemente** en `data/archivo/AAAA-MM.csv` y se enumeran en `data/archivo/index.json`. El selector de histórico mensual permite consultarlos. El histórico íntegro se conserva adicionalmente en el sistema de recogida.

## Conservación del histórico

No se elimina ningún mes archivado automáticamente. Cada mes terminado se publica en un archivo CSV separado, con marcas temporales UTC y sin nombres de centros ni credenciales. El mes en curso está disponible en el CSV reciente y, una vez terminado, se crea su archivo permanente. El archivo de 60 días puede descartar lecturas antiguas porque estas ya se conservan en el archivo mensual correspondiente.
