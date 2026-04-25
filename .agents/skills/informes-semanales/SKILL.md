---
name: informes-semanales
description: "Crea, actualiza y ordena informes semanales en español con enfoque por semanas, proyectos, actividades complementarias, historial de desarrollo y cierre ejecutivo. Use for: reportes de actividades, informes de avance, cronologías semanales, resúmenes basados en commits, y documentos que se van ampliando semana a semana."
argument-hint: "periodo, proyectos, semanas, actividades, commits"
user-invocable: true
disable-model-invocation: false
---

# Informes Semanales

Usa esta skill para construir o ampliar informes semanales en español, con un tono más casual, relajado y neutro. La idea es contar simplemente qué se hizo durante la semana como si fuera una bitácora personal o de equipo, sin sonar rebuscado o corporativo.

## Cuándo usarla
- Cuando el usuario necesita resumir lo que pasó en la semana.
- Cuando hay que juntar los commits o tareas en un documento.
- Cuando el reporte debe ir creciendo semana por semana.
- Cuando el estilo debe ser directo y sin adornos.

## Principios de redacción
- Escribe en español.
- Mantén un tono casual y neutro. Cuenta las cosas tal y como pasaron.
- Evita el lenguaje muy técnico, pero tampoco lo hagas corporativo o exagerado.
- Ordena el contenido por periodo y por semana.
- Si hay varios proyectos o temas, ponles subtítulos simples.
- Mantén continuidad con lo ya escrito: no repitas, solo agrega lo nuevo de la semana.

## Procedimiento
1. Identifica el periodo del informe.
2. Reúne las semanas que se van a reportar.
3. Agrupa la información por proyecto principal.
4. Para cada semana, resume:
   - avances funcionales
   - mejoras de estructura o calidad
   - actividades presenciales o de apoyo
   - resultados visibles
5. Si hay historial en GitHub o commits, intégralo como evidencia de desarrollo, sin convertirlo en una lista fría de cambios.
6. Cierra cada semana con una síntesis de impacto.
7. Al final del periodo, redacta un resumen general del avance acumulado.

## Estructura recomendada
- Título general del informe
- Nombre de la persona o equipo
- Periodo que cubre
- Lista breve de proyectos o frentes de trabajo
- Sección por mes o tramo de semanas
- Subsección por semana con narrativa continua
- Cierre general

## Regla para informes incrementales
Si el usuario ya trae un informe anterior:
1. Conserva el formato y la voz del documento.
2. Añade solo la semana nueva o el tramo nuevo.
3. Si una actividad continúa, actualiza su estado y avanza la narrativa.
4. Si aparecen nuevos proyectos, incorpóralos en la lista principal y dales seguimiento.

## Calidad mínima
Antes de entregar, verifica que:
- Cada semana tenga un foco claro
- Se entienda qué se hizo y por qué importa
- No haya repeticiones innecesarias
- El texto fluya como un informe real, no como una lista mecánica
- El formato sea consistente con el resto del documento

## Plantilla base
```text
INFORME DE ACTIVIDADES (Nombre)

Periodo: 2026-1S

Proyectos / frentes:
- Proyecto 1
- Proyecto 2
- Actividad 1

Marzo 2026
Semana: 9 marzo - 13 marzo
[Resumen narrativo de avances]

Semana: 16 marzo - 20 marzo
[Resumen narrativo de avances]

Abril 2026
Semana: 6 abril - 10 abril
[Resumen narrativo de avances]

Cierre general
[Balance final del periodo]
```

## Pistas de estilo
- Habla en primera persona del plural ("hicimos", "agregamos") o en un tono neutro sin darle muchas vueltas.
- Traduce los commits a acciones concretas y directas, sin exagerar el "impacto" o sonar tan espectacular.
- Evita por completo la jerga corporativa o palabras rimbombantes (como "sinergia", "consolidación", "robustecer"). Di las cosas de forma simple.
- Mantén oraciones cortas y un formato amigable que parezca escrito por un colega al hacer un repaso rápido de la semana.
