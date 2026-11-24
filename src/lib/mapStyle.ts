interface StyleLike {
  layers: { layout?: Record<string, unknown> }[]
}

function replaceNameEn(expr: unknown): unknown {
  if (!Array.isArray(expr)) return expr
  if (expr.length === 2 && expr[0] === 'get' && expr[1] === 'name_en') return ['get', 'name:es']
  return expr.map(replaceNameEn)
}

/** Los estilos de OpenFreeMap muestran nombres en inglés si existen; preferimos el español y luego el nombre local. */
export function localizeStyle<T extends StyleLike>(style: T): T {
  return {
    ...style,
    layers: style.layers.map((layer) =>
      layer.layout && 'text-field' in layer.layout
        ? { ...layer, layout: { ...layer.layout, 'text-field': replaceNameEn(layer.layout['text-field']) } }
        : layer,
    ),
  }
}
