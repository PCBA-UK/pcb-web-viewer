// Polyfill for process.nextTick
import { Buffer } from 'buffer'

window.Buffer = Buffer
window.global = window.global || window

// Simple process polyfill with nextTick
window.process = window.process || {
  env: {},
  version: 'v16.0.0',
  versions: { node: '16.0.0' },
  nextTick: function(fn) {
    const args = Array.prototype.slice.call(arguments, 1)
    Promise.resolve().then(function() {
      fn.apply(null, args)
    })
  },
  browser: true
}
