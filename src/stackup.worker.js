import './polyfill.js'
import pcbStackup from 'pcb-stackup'

// Listen for messages from main thread
self.onmessage = async (e) => {
  const { type, layers, id } = e.data

  if (type === 'render') {
    try {
      const stackup = await pcbStackup(layers)

      // Send back the SVG strings
      self.postMessage({
        type: 'result',
        id,
        top: stackup.top.svg,
        bottom: stackup.bottom.svg
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        id,
        error: error.message
      })
    }
  }
}
