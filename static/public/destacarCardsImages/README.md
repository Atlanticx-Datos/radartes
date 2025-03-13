# Imágenes para Tarjetas Destacadas

Este directorio contiene imágenes utilizadas para las tarjetas destacadas en el sitio web. Dado que cada oportunidad está etiquetada con una categoría y una disciplina, utilizamos un enfoque basado en pares para seleccionar la imagen más apropiada.

## Requisitos de Imágenes

- Todas las imágenes deben estar en formato JPG
- Tamaño recomendado: 600x400px (relación de aspecto 3:2)
- El tamaño del archivo debe estar optimizado para web (idealmente menos de 100KB)

## Categorías y Disciplinas

### Categorías
- Beca
- Residencia
- Premio
- Concurso
- Convocatoria
- Oportunidad
- Fondos
- Apoyo

### Disciplinas
- Visuales (Artes Visuales)
- Musica (Música)
- Escenicas (Artes Escénicas)
- Literatura
- Diseño
- Cine
- Otras

## Estructura del Directorio

```
destacarCardsImages/
├── visuales.jpg
├── musica.jpg
├── escenicas.jpg
├── literatura.jpg
├── diseno.jpg
├── cine.jpg
├── otras.jpg
├── placeholder.jpg (imagen de respaldo)
└── pairs/
    ├── beca-visuales.jpg
    ├── beca-musica.jpg
    ├── beca-escenicas.jpg
    ├── beca-literatura.jpg
    ├── beca-diseno.jpg
    ├── beca-cine.jpg
    ├── beca-otras.jpg
    ├── residencia-visuales.jpg
    ├── residencia-musica.jpg
    ├── residencia-escenicas.jpg
    ├── residencia-literatura.jpg
    ├── residencia-diseno.jpg
    ├── residencia-cine.jpg
    ├── residencia-otras.jpg
    ├── premio-visuales.jpg
    ├── premio-musica.jpg
    ├── premio-escenicas.jpg
    ├── premio-literatura.jpg
    ├── premio-diseno.jpg
    ├── premio-cine.jpg
    ├── premio-otras.jpg
    ├── concurso-visuales.jpg
    ├── concurso-musica.jpg
    ├── concurso-escenicas.jpg
    ├── concurso-literatura.jpg
    ├── concurso-diseno.jpg
    ├── concurso-cine.jpg
    ├── concurso-otras.jpg
    ├── convocatoria-visuales.jpg
    ├── convocatoria-musica.jpg
    ├── convocatoria-escenicas.jpg
    ├── convocatoria-literatura.jpg
    ├── convocatoria-diseno.jpg
    ├── convocatoria-cine.jpg
    ├── convocatoria-otras.jpg
    ├── oportunidad-visuales.jpg
    ├── oportunidad-musica.jpg
    ├── oportunidad-escenicas.jpg
    ├── oportunidad-literatura.jpg
    ├── oportunidad-diseno.jpg
    ├── oportunidad-cine.jpg
    ├── oportunidad-otras.jpg
    ├── fondos-visuales.jpg
    ├── fondos-musica.jpg
    ├── fondos-escenicas.jpg
    ├── fondos-literatura.jpg
    ├── fondos-diseno.jpg
    ├── fondos-cine.jpg
    ├── fondos-otras.jpg
    ├── apoyo-visuales.jpg
    ├── apoyo-musica.jpg
    ├── apoyo-escenicas.jpg
    ├── apoyo-literatura.jpg
    ├── apoyo-diseno.jpg
    ├── apoyo-cine.jpg
    └── apoyo-otras.jpg
```

## Imágenes de Pares Categoría-Disciplina

Dado que cada oportunidad tiene tanto una categoría como una disciplina, utilizamos principalmente imágenes de pares. Estas se almacenan en el subdirectorio `pairs/` con la siguiente convención de nomenclatura:

```
[categoria]-[disciplina].jpg
```

Ejemplos:
- `beca-visuales.jpg` - Para becas de artes visuales
- `residencia-literatura.jpg` - Para residencias de literatura
- `premio-musica.jpg` - Para premios de música

## Imágenes de Disciplinas

Las imágenes de disciplinas individuales se utilizan como respaldo cuando no hay disponible una imagen de par específica:

- `visuales.jpg` - Para artes visuales
- `musica.jpg` - Para música
- `escenicas.jpg` - Para artes escénicas
- `literatura.jpg` - Para literatura
- `diseno.jpg` - Para diseño
- `cine.jpg` - Para cine (también se usa para audiovisual)
- `otras.jpg` - Para otras disciplinas

## Imagen de Respaldo

La imagen `placeholder.jpg` se utilizará cuando no se encuentre una imagen específica para una disciplina o par.

## Lógica de Selección de Imágenes

El sistema seleccionará imágenes en el siguiente orden de prioridad:

1. **Par Específico Categoría-Disciplina**: Primero, busca una coincidencia exacta (por ejemplo, `beca-visuales.jpg`).

2. **Imagen de Disciplina**: Si no se encuentra ningún par, recurre a la imagen de la disciplina (por ejemplo, `visuales.jpg`).

3. **Imagen de Respaldo**: Si todo lo demás falla, utiliza la imagen predeterminada `placeholder.jpg`.

## Mejores Prácticas

- Enfócate en crear imágenes para los pares categoría-disciplina más comunes
- Mantén un estilo visual consistente en todas las imágenes
- Optimiza las imágenes para web para garantizar tiempos de carga rápidos
- Considera usar imágenes que funcionen bien con superposiciones de texto (insignias y títulos) 