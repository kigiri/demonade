# demonade

my 1.7k js mini-framework to handle state and dom updates without dependencies.

*When life give you demons (js and the dom), make demonade*

> You can tell how accomplish is a javascript developper by the
> amount of framework he builded to avoid using react.
> 
> This is my 4th iteration, yep, still bad, but my kind of bad.


## Why ?
- I wanted features that I didn't found in other "mini-frameworks".
- I don't like fighting against a library I didn't made.
- I like debugging my code.
- I want to try to accept the dom instead of running away from it.

*It's less than 300 line of code anyway.*

## Features

### Modern JS *(use es6 import / export)*

Having proper ES6 import export works out of the box in 90% of the browsers now and will keep on growing. Good enough for me.

You need support for e

### No Transpilation, No build, No tools.

I don't like webpack, babel and whatever tool you *need* to program
in JS.

I want to keep it simple, as I like it.

Code, save, reload, no source maps required, simple.

### Some amount of state management

Read only derived state **OR** read / write controlled state

#### Obligatory counter example, controlled state:
```js
import { h, initState, replace } from './dom.js'

const state = initState({ count: 0 })
const inc = n => () => state.count.set(state.count.get() + n)

replace(document.getElementById('root'), [
  h.button({ onclick: inc(+1) }, 'increment'),
  h.button({ onclick: inc(-1) }, 'decrement'),
  h.span([ 'count: ', h.b(state.count) ]), // bound to the state
])
```

#### An input, derived state:
```js
import { h, initState, replace, persist } from './dom.js'

const input = h.input()
const state = initState({ text: input })

// don't loose the input value on reload
persist(state.text, { elem: input })

// listen to state changes
state.text.sub(console.log)

// mount the component
replace(document.getElementById('root'), input)
```

#### Cleanup with `onDismount`

It's triggerd once an element get out of the dom

```js
import { h, replace } from './dom.js'

const id = setInterval(console.log, 500, 'mounted!')
const ondismount = () => clearInterval(id)
const elem = h.div({ ondismount })

setTimeout(() => elem.remove(), 3000)
replace(document.getElementById('root'), elem)
```

### Light and Hackable

Internals are exposed, no plugin system required, just add what you need on top of it.

It use the `Real DOM` :tm: so it plays nice with anything else.


### Fastest framework in the world

Sorry, I lied, It should not be slow, but it has not been benchmarked in anyway, don't trust me.

But because it's just the dom you can go all in and optimize what you need without
the framework going in your way.

The most important things for avoiding laggy UI is to properly separate read
and write to the DOM.

This alone remove the risk of accidentally trashing the layout and triggering
updates in loops.

So you want your app to be fast ?

Only read from the `state`, only write to the state.


You can add a function to the `subscriber` map to ensure execute writing at the
good moment.

And use the `reader` map to read data from state if not from the state.


### Local persistance

It's using `localStorage` & `JSON.stringify` so, it has a real cost, avoid using it for very hot data.

It's just very usefull for user settings and not loosing half filled forms.


### Terse, JSX free, a la `hyperscript`

A lot of people admit they ended up feeling stupid about their rejection of `JSX`. I've used it a lot, still don't like it.

It's not quite `HTML` not quite `JS`.

I feel like a simple js API would be more elegant, so that's what I use.

```js
import { h, replace } from './dom.js'

const { div, code } = h
const root = document.getElementById('root')

replace(root, div([
  'This is some code',
  code({ className: 'code highlight javascript' }, `
    console.log('hello world!')
  `)
]))
```

#### Changes from `react` api
- `Array` as valid child type (no need for fragments)
- `props` are optionnal
- a `Proxy` is used as a lazy dynamic specific tag builder.
- directly the dom, no syntethic events and virtual dom.


## Anti-features

### No Insurrance

Might never get any update, maybe framework #5 will be the one, for real this time.

### No tests

Yet.

### Weak compatibility

No `es5` or `ie9` compatibility.


### Unstructured and no virtual dom

One of the great benefit of the virtual dom is the simplicity of representing
the dom as a function.

Doing the same here will trash and recreate all the dom on each render,
so yeah that sucks.

If you need performance, you'll have to handle yourself to avoid recreating
the component and just updating it.


With great freedom comes a lot of way to fuck up, you have both of those.

Do your mess, have fun.

## Roadmap

### SVG / Namespaces

Should not be much work but not yet needed it.


### Routing

I might add a minimal `a` component to handle basic redirect catch.

Didn't even needed a router *yet* for the kind of apps made with this.
