# Ocupación del club

Panel web público, sin identificación del centro ni detalles de su proveedor.

## Qué muestra

- Última lectura de ocupación y su antigüedad.
- Evolución de hoy, ayer, últimos 7 días y últimos 30 días.
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

La web no gestiona accesos ni consulta servicios externos. Solo lee el CSV publicado en este repositorio. El sistema que recopila las lecturas es independiente y debe publicar **únicamente** dos campos: `timestamp` en UTC e `people` como entero. No se deben publicar nombres de centros, URLs privadas, identificadores de sesión ni credenciales.

Si no hay lecturas, la página muestra un estado sin datos. Los colores del mapa de calor son **relativos al histórico disponible**, no porcentajes de aforo ni de capacidad máxima.

## Funcionamiento

Sitio estático sin dependencias, analíticas, cookies ni almacenamiento local. Todas las horas se muestran en la zona horaria `Europe/Madrid`.

## Frecuencia y estado

Se prevé una lectura cada 5 minutos desde un proceso externo. La web comprueba el CSV cada minuto sin recargar la página y advierte si la lectura más reciente supera los 20 minutos de antigüedad. La publicación puede tener un pequeño retraso respecto de la toma de datos. El CSV público contiene hasta 60 días de lecturas; el histórico completo se conserva fuera de este repositorio.
