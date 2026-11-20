# Desglose estimado en el gráfico histórico

## Presentación

En «Evolución de la ocupación» se ha añadido el botón **Ver desglose apilado**. La línea «Total en el club (medido)» conserva siempre el contador real de personas. Las áreas deportivas son **personas equivalentes estimadas** a partir de reservas u otras fuentes verificadas, nunca registros de asistentes físicos:

- Actividades dirigidas: estimación basada en plazas reservadas de una sesión, idealmente consultada después de finalizar.
- Tenis, esquaix y frontón: estimaciones pendientes de validar. Tennis Individual (60 min) y Tennis Dobles (90 min) usan las mismas pistas físicas, sin sumar sus capacidades.
- «Sin atribuir (residual estimado)»: diferencia aritmética entre el total real y las categorías estimadas conocidas. Incluye otras actividades, fitness y categorías sin datos. **No equivale a un recuento identificado de estas personas**.

Al activar el desglose, las áreas se apilan por separado de la línea superior del total. Cuando falten puntos, se conserva el gráfico normal para esos periodos. El periodo Hoy usa muestras individuales, 7 días usa medias por hora y 30 días / meses usan medias por día. Para intervalos agregados solo se utilizan componentes con cobertura completa en las lecturas que contribuyen a la media. No se interpolan periodos sin datos.

## Fuente pública

La fuente opcional es `data/desglose.json`, con este esquema:

```json
{
  "version": 1,
  "metric": "estimated_people_by_category",
  "points": [
    {
      "timestamp": "2026-11-20T14:00:00.000Z",
      "directed": 20,
      "tennis": null,
      "squash": null,
      "fronton": null
    }
  ]
}
```

El ejemplo anterior es **solo ilustrativo y no debe publicarse como dato real**. El archivo inicial contiene `points: []`, sin cifras inventadas. Los números deben ser agregados ya validados; `null` significa desconocido y **nunca** se sustituye silenciosamente por cero. El cliente omite cantidades de 1 a 4 personas por categoría para no publicar grupos muy pequeños.

Los puntos deben coincidir temporalmente (tolerancia ±8 minutos) con lecturas reales de ocupación. Si la suma estimada supera el total real, se omite el desglose del intervalo en lugar de alterar el total. El fichero no admite etiquetas de actividades, nombres de docentes, números de socios, IDs de sesiones, ubicación ni URL del club.

## Generación de vista previa privada

En el repositorio de captura privado se ha añadido `activities_breakdown_preview.py`, que puede cruzar las reservas confirmadas **tras finalizar una actividad** con las lecturas del CSV de ocupación. Redondea los agregados a grupos de cinco y no incluye tenis, squash o frontón mientras sus contadores sigan sin verificar.

El archivo producido por defecto es `/var/lib/ocupacion-club/desglose-preview.json` y **no se publica ni se copia al repositorio público**. No hay ningún timer para publicarlo. Debe revisarse y validarse antes de autorizar su publicación porque las series por hora podrían facilitar identificar indirectamente el club por su programación.

No se debe sumar el número de jugadores estimados al total real: todas las áreas, incluido el residual teórico, deben caber bajo la línea del total medido. Tampoco presentar el residual como «personas en fitness», ya que no disponemos de mediciones por zona.

## Pruebas

```bash
node --test test/desglose-model.test.js
```

Para volver al gráfico original, pulsar **Ver solo ocupación real**.

### Consulta de un día concreto

El control **Día** del gráfico filtra la serie de ocupación real y el desglose estimado por una única fecha local de Madrid, con los puntos originales de cada lectura. No usa medias horarias ni diarias cuando está seleccionado un día. Para fechas fuera del CSV reciente consulta el archivo mensual necesario bajo demanda. **Limpiar** restaura Hoy. La ausencia de una serie deportiva no equivale a cero personas: el gráfico mantiene la línea medida.
