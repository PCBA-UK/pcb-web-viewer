import './src/polyfill.js'
import pcbStackup from 'pcb-stackup'

// DOM Elements
const modalOverlay = document.getElementById('modalOverlay')
const uploadZone = document.getElementById('uploadZone')
const fileInput = document.getElementById('fileInput')
const loading = document.getElementById('loading')
const viewer = document.getElementById('viewer')
const svgContainer = document.getElementById('svgContainer')
const topSvg = document.getElementById('topSvg')
const bottomSvg = document.getElementById('bottomSvg')
const topBtn = document.getElementById('topBtn')
const bottomBtn = document.getElementById('bottomBtn')
const zoomInBtn = document.getElementById('zoomInBtn')
const zoomOutBtn = document.getElementById('zoomOutBtn')
const resetBtn = document.getElementById('resetBtn')
const zoomLevel = document.getElementById('zoomLevel')
const openBtn = document.getElementById('openBtn')
const loadExampleBtn = document.getElementById('loadExampleBtn')
const fileBar = document.getElementById('fileBar')
const fileInfo = document.getElementById('fileInfo')
const clearBtn = document.getElementById('clearBtn')
const placeholder = document.getElementById('placeholder')
const errorMessage = document.getElementById('errorMessage')
const errorText = document.getElementById('errorText')
const dismissError = document.getElementById('dismissError')
const layersPanel = document.getElementById('layersPanel')
const toggleLayersBtn = document.getElementById('toggleLayersBtn')
const pasteToggle = document.getElementById('pasteToggle')

// State
let inputLayers = []
let fileNames = []
let currentView = 'top'
let showPaste = true
let cachedWithPaste = null // { top, bottom }
let cachedWithoutPaste = null // { top, bottom }
let scale = 1
let panX = 0
let panY = 0
let isDragging = false
let startX, startY

// Example files
const exampleFiles = [
  'examples/board-F.Cu.gtl',
  'examples/board-B.Cu.gbl',
  'examples/board-F.Mask.gts',
  'examples/board-B.Mask.gbs',
  'examples/board-F.SilkS.gto',
  'examples/board-B.SilkS.gbo',
  'examples/board-Edge.Cuts.gm1'
]

// Show modal on page load
modalOverlay.classList.remove('hidden')
layersPanel.classList.add('hidden')

// Open button shows modal
openBtn.addEventListener('click', () => {
  modalOverlay.classList.remove('hidden')
})

// Close modal when clicking outside
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    if (inputLayers.length > 0) {
      modalOverlay.classList.add('hidden')
    }
  }
})

// Dismiss error
dismissError.addEventListener('click', () => {
  errorMessage.classList.remove('active')
})

// Toggle layers panel
toggleLayersBtn.addEventListener('click', () => {
  layersPanel.classList.toggle('collapsed')
})

// Paste toggle
pasteToggle.addEventListener('change', () => {
  showPaste = pasteToggle.checked
  displayCachedBoard()
})

// File handling
fileInput.addEventListener('change', handleFileSelect)

// Click on upload zone triggers file input (but not buttons)
uploadZone.addEventListener('click', (e) => {
  if (!e.target.closest('.file-input-label') && !e.target.closest('.example-btn')) {
    fileInput.click()
  }
})

// Load example button
loadExampleBtn.addEventListener('click', async (e) => {
  e.stopPropagation()
  await loadExampleFiles()
})

// Clear button
clearBtn.addEventListener('click', clearAll)

// Drag and drop on upload zone
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadZone.classList.add('dragover')
})

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover')
})

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadZone.classList.remove('dragover')
  handleFiles(e.dataTransfer.files)
})

// Global drag and drop (on viewer)
viewer.addEventListener('dragover', (e) => {
  e.preventDefault()
})

viewer.addEventListener('drop', (e) => {
  e.preventDefault()
  handleFiles(e.dataTransfer.files)
})

function handleFileSelect(e) {
  handleFiles(e.target.files)
}

async function handleFiles(fileListInput) {
  const newFiles = Array.from(fileListInput).filter(file => {
    return !fileNames.includes(file.name)
  })

  if (newFiles.length === 0) return

  showLoading()

  try {
    const readPromises = newFiles.map(async (file) => {
      const content = await readFileAsText(file)
      return {
        filename: file.name,
        gerber: content
      }
    })

    const newLayers = await Promise.all(readPromises)
    inputLayers = [...inputLayers, ...newLayers]
    fileNames = [...fileNames, ...newFiles.map(f => f.name)]

    await renderStackup()
  } catch (error) {
    console.error('Error processing files:', error)
    showError(error.message || 'Failed to process Gerber files.')
  }
}

async function loadExampleFiles() {
  showLoading()

  try {
    const fetchPromises = exampleFiles.map(async (path) => {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Failed to load ${path}`)
      const content = await response.text()
      const filename = path.split('/').pop()
      return { filename, gerber: content }
    })

    inputLayers = await Promise.all(fetchPromises)
    fileNames = exampleFiles.map(path => path.split('/').pop())

    await renderStackup()
  } catch (error) {
    console.error('Error loading example files:', error)
    showError(error.message || 'Failed to load example files.')
  }
}

function clearAll() {
  inputLayers = []
  fileNames = []
  cachedWithPaste = null
  cachedWithoutPaste = null
  placeholder.classList.remove('hidden')
  fileBar.classList.remove('active')
  layersPanel.classList.add('hidden')
  topSvg.innerHTML = ''
  bottomSvg.innerHTML = ''
  modalOverlay.classList.remove('hidden')

  scale = 1
  panX = 0
  panY = 0
  updateTransform()
  updateZoomLevel()
}

function showLoading() {
  loading.classList.add('active')
  errorMessage.classList.remove('active')
}

function hideLoading() {
  loading.classList.remove('active')
}

function showError(message) {
  hideLoading()
  errorText.textContent = message
  errorMessage.classList.add('active')
}

async function renderStackup() {
  if (inputLayers.length === 0) {
    hideLoading()
    return
  }

  try {
    // Generate version WITH paste
    const stackupWithPaste = await pcbStackup(inputLayers)
    cachedWithPaste = {
      top: stackupWithPaste.top.svg,
      bottom: stackupWithPaste.bottom.svg
    }

    // Generate version WITHOUT paste
    const layersWithoutPaste = inputLayers.filter(layer => {
      const filename = layer.filename.toLowerCase()
      return !filename.includes('paste') && !filename.includes('.gtp') && !filename.includes('.gbp')
    })

    if (layersWithoutPaste.length > 0) {
      const stackupWithoutPaste = await pcbStackup(layersWithoutPaste)
      cachedWithoutPaste = {
        top: stackupWithoutPaste.top.svg,
        bottom: stackupWithoutPaste.bottom.svg
      }
    } else {
      // If no layers without paste, just use the same as with paste
      cachedWithoutPaste = cachedWithPaste
    }

    // Display the current selection
    displayCachedBoard()

    scale = 1
    panX = 0
    panY = 0
    updateTransform()
    updateZoomLevel()

    placeholder.classList.add('hidden')
    fileBar.classList.add('active')
    fileInfo.textContent = `${fileNames.length} file${fileNames.length !== 1 ? 's' : ''} loaded`
    modalOverlay.classList.add('hidden')
    layersPanel.classList.remove('hidden')

    hideLoading()

  } catch (error) {
    console.error('Error rendering stackup:', error)
    showError(error.message || 'Failed to render PCB.')
  }
}

function displayCachedBoard() {
  const cached = showPaste ? cachedWithPaste : cachedWithoutPaste

  if (!cached) return

  topSvg.innerHTML = cached.top
  bottomSvg.innerHTML = cached.bottom

  const topSvgEl = topSvg.querySelector('svg')
  if (topSvgEl) {
    topSvgEl.style.maxWidth = '80vw'
    topSvgEl.style.maxHeight = '80vh'
  }

  const bottomSvgEl = bottomSvg.querySelector('svg')
  if (bottomSvgEl) {
    bottomSvgEl.style.maxWidth = '80vw'
    bottomSvgEl.style.maxHeight = '80vh'
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// View toggle
topBtn.addEventListener('click', () => switchView('top'))
bottomBtn.addEventListener('click', () => switchView('bottom'))

function switchView(view) {
  currentView = view

  if (view === 'top') {
    topBtn.classList.add('active')
    bottomBtn.classList.remove('active')
    topSvg.classList.remove('hidden')
    bottomSvg.classList.add('hidden')
  } else {
    topBtn.classList.remove('active')
    bottomBtn.classList.add('active')
    topSvg.classList.add('hidden')
    bottomSvg.classList.remove('hidden')
  }
}

// Zoom controls
zoomInBtn.addEventListener('click', () => {
  scale = Math.min(scale * 1.25, 10)
  updateTransform()
  updateZoomLevel()
})

zoomOutBtn.addEventListener('click', () => {
  scale = Math.max(scale / 1.25, 0.1)
  updateTransform()
  updateZoomLevel()
})

resetBtn.addEventListener('click', () => {
  scale = 1
  panX = 0
  panY = 0
  updateTransform()
  updateZoomLevel()
})

function updateTransform() {
  svgContainer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`
}

function updateZoomLevel() {
  zoomLevel.textContent = `${Math.round(scale * 100)}%`
}

// Pan functionality
viewer.addEventListener('mousedown', (e) => {
  if (e.target.closest('.placeholder') || e.target.closest('.layers-panel')) return
  isDragging = true
  startX = e.clientX - panX
  startY = e.clientY - panY
})

viewer.addEventListener('mousemove', (e) => {
  if (!isDragging) return
  panX = e.clientX - startX
  panY = e.clientY - startY
  updateTransform()
})

viewer.addEventListener('mouseup', () => {
  isDragging = false
})

viewer.addEventListener('mouseleave', () => {
  isDragging = false
})

// Mouse wheel zoom
viewer.addEventListener('wheel', (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale = Math.max(0.1, Math.min(10, scale + delta))
  updateTransform()
  updateZoomLevel()
}, { passive: false })

// Touch support
let touchStartX, touchStartY, initialPinchDistance

viewer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 1) {
    isDragging = true
    touchStartX = e.touches[0].clientX - panX
    touchStartY = e.touches[0].clientY - panY
  } else if (e.touches.length === 2) {
    initialPinchDistance = getPinchDistance(e.touches)
  }
})

viewer.addEventListener('touchmove', (e) => {
  e.preventDefault()

  if (e.touches.length === 1 && isDragging) {
    panX = e.touches[0].clientX - touchStartX
    panY = e.touches[0].clientY - touchStartY
    updateTransform()
  } else if (e.touches.length === 2) {
    const currentDistance = getPinchDistance(e.touches)
    const scaleFactor = currentDistance / initialPinchDistance
    scale = Math.max(0.1, Math.min(10, scale * scaleFactor))
    initialPinchDistance = currentDistance
    updateTransform()
    updateZoomLevel()
  }
}, { passive: false })

viewer.addEventListener('touchend', () => {
  isDragging = false
})

function getPinchDistance(touches) {
  return Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY
  )
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return

  if (e.key === 't' || e.key === 'T') {
    switchView('top')
  } else if (e.key === 'b' || e.key === 'B') {
    switchView('bottom')
  } else if (e.key === '+' || e.key === '=') {
    scale = Math.min(scale * 1.25, 10)
    updateTransform()
    updateZoomLevel()
  } else if (e.key === '-') {
    scale = Math.max(scale / 1.25, 0.1)
    updateTransform()
    updateZoomLevel()
  } else if (e.key === '0') {
    scale = 1
    panX = 0
    panY = 0
    updateTransform()
    updateZoomLevel()
  } else if (e.key === 'Escape') {
    if (inputLayers.length > 0) {
      modalOverlay.classList.add('hidden')
    }
  } else if (e.key === 'o' || e.key === 'O') {
    modalOverlay.classList.remove('hidden')
  } else if (e.key === 'l' || e.key === 'L') {
    layersPanel.classList.toggle('collapsed')
  } else if (e.key === 'p' || e.key === 'P') {
    showPaste = !showPaste
    pasteToggle.checked = showPaste
    displayCachedBoard()
  }
})
