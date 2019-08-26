export const PATH = Symbol('path')
export const subscribers = new Set()
export const readers = new Set()
export const values = Object.create(null)
export const onDismount = new Map()
let refs = new Set()
const contains = (a, b) => {
  for (const elem of a) {
    if (b.has(elem)) return true
  }
  return false
}
const loop = () => {
  refs = new Set()
  for (const [elem, handler] of onDismount) {
    if (document.body.contains(elem)) continue
    handler(elem)
  }
  for (const reader of readers) {
    try {
      reader(refs)
    } catch (err) {
      err.reader = reader
      console.error(err)
    }
  }

  for (const sub of subscribers) {
    if (sub.ref) {
      refs.has(sub.ref) && sub(values[sub.ref])
    } else if (sub.refs) {
      contains(sub.refs, refs) && sub()
    }
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

export const isObject = value => value && value.constructor === Object
export const toId = key => /^[$A-Za-z_][0-9A-Za-z_$]*$/.test(key)
  ? `.${key}`
  : `[${JSON.stringify(key)}]`

const nodeGetters = n => {
  switch (n.type) {
    case 'number':
    case 'range': return () => Number(n.value)
    case 'radio':
    case 'checkbox': return () => n.checked
    default: return () => n.value
  }
}

const nodeSetters = n => {
  const k = (n.type === 'radio' || n.type === 'checkbox') ? 'checked' : 'value'
  return v => n[k] = v
}

const toSetBody = (_, i, paths) =>
  `r.add(${JSON.stringify(paths.slice(0, i + 1).join(''))})`

const buildWatchProps = (acc, [k, v]) => {
  const ref = v[PATH]
  if (ref) {
    Object.defineProperty(acc, k, {
      get() {
        this[PATH].add(ref)
        return values[ref]
      }
    })
  } else {
    acc[k] = buildWatchProto(v)
  }
  return acc
}
const buildWatchProto = obj => Object.entries(obj).reduce(buildWatchProps, {})
export const initState = state => {
  const build = (value, paths) => {
    if (isObject(value)) {
      return Object.fromEntries(Object.entries(value)
        .map(([ k, v ]) => [ k, build(v, [...paths, toId(k)]) ]))
    }
    const path = paths.join('')
    const set = new Function(['s', 'v'], `return ${path}=v`)
    const v = { [PATH]: path, get: () => values[path] }

    if (value instanceof Node) {
      v.set = nodeSetters(value)
      values[path] = nodeGetters(value)
    }

    const refresh = new Function(['r'], `${paths.map(toSetBody).join(';\n')}`)
    if (typeof value === 'function') {
      const reader = value
      values[path] = reader()
      readers.add(refs => {
        const next = reader()
        if (next === values[path]) return
        values[path] = next
        set(state, next)
        refresh(refs)
      })
    } else {
      values[path] = value
      v.set = newValue => set(state, newValue)
      const reader = new Function(['s'], `return ${path}`)
      readers.add(refs => {
        const next = reader(state)
        if (next === values[path]) return
        values[path] = next
        refresh(refs)
      })
    }

    v.sub = sub => {
      sub(values[path])
      sub.ref = path
      subscribers.add(sub)
      return () => subscribers.delete(sub)
    }

    return v
  }

  const base = build(state, ['s'])
  const proto = buildWatchProto(base)
  base.sub = sub => {
    const subState = Object.create(proto)
    const subber = () => sub(subState)
    subber.refs = subState[PATH] = new Set()
    sub(subState)
    subscribers.add(subber)
  }
  return base
}

export const append = (elem, value) => {
  if (value == undefined) return elem
  switch (typeof value) {
    case 'string':
    case 'number':
      elem.appendChild(document.createTextNode(value))
      return elem
    case 'function':
    case 'boolean': return elem
    case 'symbol': return append(elem, `Symbol(${value.description})`)
    case 'object': {
      if (value[PATH] !== undefined) {
        const node = document.createTextNode('')
        let unsub
        const reader = () => {
          if (document.body.contains(elem)) {
            unsub || (unsub = value.sub(v => node.nodeValue = v))
          } else if (unsub) {
            unsub()
            unsub = undefined
            readers.delete(reader)
          }
        }
        readers.add(reader)
        elem[PATH] = reader
        onDismount.set(elem, () => readers.delete(reader))
        elem.appendChild(node)
        return elem
      }

      if (value instanceof Node) {
        elem.appendChild(value)
        return elem
      }

      if (Array.isArray(value)) {
        for (const v of value) {
          append(elem, v)
        }
        return elem
      }
    }
    console.warn('Unexpected children value type', value, elem)
    return elem
  }
}

const mergeValue = (src, key, value) => (value && value[PATH] !== undefined)
  ? value.sub(v => src[key] = v)
  : src[key] = value

export const createElement = (tag, a, b) => {
  // TODO: handle namespace for SVG
  const elem = document.createElement(tag)
  if (a == null) return elem
  if (!isObject(a) || a[PATH] !== undefined) return append(elem, a)
  for (const key of Object.keys(a)) {
    const value = a[key]
    if (value == null) continue
    if (key === 'ondismount') {
      if (typeof value !== 'function') continue
      onDismount.set(elem, value)
      continue
    }
    if (isObject(value) && value[PATH] === undefined) {
      for (const k of Object.keys(value)) {
        mergeValue(elem[key], k, value[k])
      }
    } else {
      mergeValue(elem, key, value)
    }
  }
  return append(elem, b)
}

export const h = new Proxy({}, {
  get: (s, tag) => s[tag] || (s[tag] = (a, b) => createElement(tag, a, b))
})

export const watch = object => Object.fromEntries(Object.keys(object)
  .filter(k => typeof object[k] !== 'function')
  .map(k => [ k, isObject(object[k]) ? watch(object[k]) : () => object[k]]))

export const empty = elem => {
  while (elem && elem.firstChild) {
    elem.removeChild(elem.firstChild)
  }
  return elem
}

const save = (k, v) => localStorage[k] = JSON.stringify(v)
export const persist = (value, { prefix = '@@', elem } = {}) => {
  const key = `${prefix}${value[PATH]}`
  const cached = localStorage[key]
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      elem && (elem.value = parsed)
      value.set && value.set(parsed)
    }
    catch (err) { localStorage[key] = JSON.stringify(value.get()) }
  } else {
    localStorage[key] = JSON.stringify(value.get())
  }

  let t
  return value.sub(v => {
    clearTimeout(t)
    t = setTimeout(save, 200, key, v)
  })
}

export const replace = (elem, content) => append(empty(elem), content)
export const setText = (elem, text) => elem.firstChild.nodeValue = text
export const map = (value, mapper) => {
  let v = mapper(value.get())
  return {
    [PATH]: value[PATH],
    get: () => v,
    sub: sub => value.sub(_v => sub(v = mapper(_v))),
  }
}
