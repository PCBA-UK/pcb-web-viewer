// Polyfill for process.nextTick - works in both main thread and worker
import { Buffer } from 'buffer'

// Get the global object (window in main thread, self in worker)
const globalObj = typeof window !== 'undefined' ? window : self

globalObj.Buffer = Buffer
globalObj.global = globalObj.global || globalObj

// Simple process polyfill with nextTick
globalObj.process = globalObj.process || {
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
