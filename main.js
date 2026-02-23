import './src/polyfill.js'
import { unzipSync } from 'fflate'
import { Archive } from 'libarchive.js'

// Create two Web Workers for parallel pcb-stackup processing
const workerUrl = new URL('./src/stackup.worker.js', import.meta.url)
const stackupWorker1 = new Worker(workerUrl, { type: 'module' })
const stackupWorker2 = new Worker(workerUrl, { type: 'module' })

// Worker promise tracking
let workerTaskId = 0
const workerPromises = new Map()

function handleWorkerMessage(e) {
  const { type, id, top, bottom, error } = e.data
  const resolver = workerPromises.get(id)

  if (resolver) {
    workerPromises.delete(id)
    if (type === 'result') {
      resolver.resolve({ top, bottom })
    } else if (type === 'error') {
      resolver.reject(new Error(error))
    }
  }
}

stackupWorker1.onmessage = handleWorkerMessage
stackupWorker2.onmessage = handleWorkerMessage

// Function to send work to a specific worker and get a promise back
function renderStackupInWorker(layers, worker = stackupWorker1) {
  return new Promise((resolve, reject) => {
    const id = ++workerTaskId
    workerPromises.set(id, { resolve, reject })
    worker.postMessage({ type: 'render', layers, id })
  })
}

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
let minScale = 0.01 // Minimum zoom level
let panX = 0
let panY = 0
let isDragging = false
let startX, startY

// Import all files from sample folder as raw text
const sampleModules = import.meta.glob('./sample/*', { eager: true, query: '?raw' })

// Show modal on page load
modalOverlay.classList.remove('hidden')
layersPanel.classList.add('hidden')

// Open button shows modal
openBtn.addEventListener('click', () => {
  // Clear existing data before opening upload modal
  inputLayers = []
  fileNames = []
  cachedWithPaste = null
  cachedWithoutPaste = null
  topSvg.innerHTML = ''
  bottomSvg.innerHTML = ''
  placeholder.classList.remove('hidden')
  fileBar.classList.remove('active')
  layersPanel.classList.add('hidden')
  scale = 1
  panX = 0
  panY = 0
  updateTransform()
  updateZoomLevel()

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

// Gerber file extensions
const gerberExtensions = [
  '.gbr', '.gtl', '.gbl', '.gts', '.gbs', '.gto', '.gbo',
  '.gtp', '.gbp', '.gm1', '.gml', '.gko', '.drl', '.pho', '.ger', '.spl'
]

// Check if file is a gerber file by extension
function isGerberFile(filename) {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return false
  const ext = filename.toLowerCase().slice(dotIndex)
  return gerberExtensions.includes(ext)
}

// Check if .txt file is actually a drill file by content
function isDrillFile(content) {
  const firstLines = content.slice(0, 1000).toUpperCase()

  // Excellon drill file indicators
  if (firstLines.includes('M48') ||
      firstLines.includes('INCH') ||
      firstLines.includes('METRIC') ||
      firstLines.includes('FMAT,2') ||
      firstLines.includes(';FILE_FORMAT') ||
      /^T\d+C\d+/m.test(firstLines)) {
    return true
  }

  // Sieb & Mayer drill file indicators
  if (firstLines.includes('%TNC') ||
      firstLines.includes('TNC')) {
    return true
  }

  return false
}

// Check if .txt file is a pick-and-place file (should be ignored)
function isPickAndPlaceFile(content) {
  const firstLines = content.slice(0, 500).toLowerCase()

  // Common pick-and-place headers
  if (firstLines.includes('designator') ||
      firstLines.includes('footprint') ||
      firstLines.includes('refdes') ||
      firstLines.includes('comment') && firstLines.includes('pattern')) {
    return true
  }

  // Check for CSV-like structure with coordinates
  const lines = content.slice(0, 300).split('\n')
  if (lines.length >= 2) {
    const headerLine = lines[0].toLowerCase()
    if ((headerLine.includes('x') && headerLine.includes('y') && headerLine.includes('val') ||
         headerLine.includes('mid x') || headerLine.includes('posx'))) {
      return true
    }
  }

  return false
}

// Check if file is an archive
function isArchive(filename) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.zip') ||
         lower.endsWith('.tar') ||
         lower.endsWith('.tar.gz') ||
         lower.endsWith('.tgz') ||
         lower.endsWith('.7z') ||
         lower.endsWith('.rar')
}

// Check if archive is ZIP (handled by fflate)
function isZipArchive(filename) {
  return filename.toLowerCase().endsWith('.zip')
}

// Extract gerber files from a ZIP archive using fflate
function extractFromZip(arrayBuffer, archiveName) {
  const layers = []
  const names = []

  try {
    const unzipped = unzipSync(new Uint8Array(arrayBuffer))

    for (const [path, data] of Object.entries(unzipped)) {
      // Skip directories
      if (path.endsWith('/')) continue

      // Get filename from path (handles subfolders)
      const filename = path.split('/').pop()
      if (!filename) continue

      if (isGerberFile(filename)) {
        const content = new TextDecoder().decode(data)
        layers.push({
          filename: filename,
          gerber: content
        })
        names.push(`${archiveName}/${filename}`)
      } else if (filename.toLowerCase().endsWith('.txt')) {
        const content = new TextDecoder().decode(data)

        if (isPickAndPlaceFile(content)) continue

        if (isDrillFile(content)) {
          layers.push({
            filename: filename,
            gerber: content
          })
          names.push(`${archiveName}/${filename}`)
        }
      }
    }
  } catch (error) {
    console.error('Error extracting ZIP:', error)
    throw new Error(`Failed to extract ${archiveName}: ${error.message}`)
  }

  return { layers, names }
}

// Extract gerber files from other archives using libarchive.js
async function extractFromOtherArchive(file, archiveName) {
  const layers = []
  const names = []

  try {
    const archive = await Archive.open(file)
    const files = await archive.getFilesArray()

    for (const extractedFile of files) {
      const path = extractedFile.path || extractedFile.name || ''
      // Skip directories
      if (path.endsWith('/')) continue

      // Get filename from path (handles subfolders)
      const filename = path.split('/').pop()
      if (!filename) continue

      if (isGerberFile(filename)) {
        const content = await extractedFile.getText()
        layers.push({
          filename: filename,
          gerber: content
        })
        names.push(`${archiveName}/${filename}`)
      } else if (filename.toLowerCase().endsWith('.txt')) {
        const content = await extractedFile.getText()

        if (isPickAndPlaceFile(content)) continue

        if (isDrillFile(content)) {
          layers.push({
            filename: filename,
            gerber: content
          })
          names.push(`${archiveName}/${filename}`)
        }
      }
    }
  } catch (error) {
    console.error('Error extracting archive:', error)
    throw new Error(`Failed to extract ${archiveName}: ${error.message}`)
  }

  return { layers, names }
}

// Extract gerber files from an archive
async function extractFromArchive(file, archiveName) {
  if (isZipArchive(archiveName)) {
    // Use fflate for ZIP files (more reliable)
    const arrayBuffer = await file.arrayBuffer()
    return extractFromZip(arrayBuffer, archiveName)
  } else {
    // Use libarchive.js for other formats (7z, RAR, TAR)
    return extractFromOtherArchive(file, archiveName)
  }
}

async function handleFiles(fileListInput) {
  const newFiles = Array.from(fileListInput).filter(file => {
    return !fileNames.includes(file.name)
  })

  if (newFiles.length === 0) return

  showLoading()

  try {
    const newLayers = []
    const newNames = []

    for (const file of newFiles) {
      if (isArchive(file.name)) {
        // Handle archive (ZIP, TAR, 7z, RAR)
        const extracted = await extractFromArchive(file, file.name)
        newLayers.push(...extracted.layers)
        newNames.push(...extracted.names)
      } else if (isGerberFile(file.name)) {
        // Handle regular gerber file
        const content = await readFileAsText(file)
        newLayers.push({
          filename: file.name,
          gerber: content
        })
        newNames.push(file.name)
      } else if (file.name.toLowerCase().endsWith('.txt')) {
        // Check if .txt file is a drill file
        const content = await readFileAsText(file)

        if (isPickAndPlaceFile(content)) continue

        if (isDrillFile(content)) {
          // It's a drill file, include it
          newLayers.push({
            filename: file.name,
            gerber: content
          })
          newNames.push(file.name)
        }
      }
      // Ignore other non-gerber files
    }

    if (newLayers.length === 0) {
      hideLoading()
      showError('No Gerber files found in the selected files.')
      return
    }

    inputLayers = [...inputLayers, ...newLayers]
    fileNames = [...fileNames, ...newNames]

    await renderStackup()
  } catch (error) {
    console.error('Error processing files:', error)
    showError(error.message || 'Failed to process Gerber files.')
  }
}

async function loadExampleFiles() {
  showLoading()

  try {
    // Get all files from sample folder
    const sampleFiles = Object.entries(sampleModules)
      .filter(([path, module]) => {
        const filename = path.split('/').pop()
        // Check if it's a gerber file or drill file
        if (isGerberFile(filename)) return true
        if (filename.toLowerCase().endsWith('.txt')) {
          // Check if it's a drill file
          const content = module?.default || ''
          return isDrillFile(content) && !isPickAndPlaceFile(content)
        }
        return false
      })
      .map(([path, module]) => {
        const filename = path.split('/').pop()
        const content = module?.default || ''
        return { filename, gerber: content }
      })

    if (sampleFiles.length === 0) {
      hideLoading()
      showError('No Gerber files found in sample folder.')
      return
    }

    inputLayers = sampleFiles
    fileNames = sampleFiles.map(f => f.filename)

    await renderStackup()
  } catch (error) {
    console.error('Error loading sample files:', error)
    showError(error.message || 'Failed to load sample files.')
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
    // Generate versions WITHOUT paste layer for filtering
    const layersWithoutPaste = inputLayers.filter(layer => {
      const filename = layer.filename.toLowerCase()
      return !filename.includes('paste') && !filename.includes('.gtp') && !filename.includes('.gbp')
    })

    // Process both versions in parallel using two workers
    const hasPasteLayers = layersWithoutPaste.length < inputLayers.length

    let results
    if (hasPasteLayers && layersWithoutPaste.length > 0) {
      // Process both versions in parallel
      results = await Promise.all([
        renderStackupInWorker(inputLayers, stackupWorker1),
        renderStackupInWorker(layersWithoutPaste, stackupWorker2)
      ])
      cachedWithPaste = { top: results[0].top, bottom: results[0].bottom }
      cachedWithoutPaste = { top: results[1].top, bottom: results[1].bottom }
    } else {
      // Only one version needed (no paste layers or only paste layers)
      const result = await renderStackupInWorker(inputLayers, stackupWorker1)
      cachedWithPaste = { top: result.top, bottom: result.bottom }
      cachedWithoutPaste = cachedWithPaste
    }

    // Display the current selection
    displayCachedBoard()

    // Fit to screen after DOM updates
    requestAnimationFrame(() => {
      fitToScreen()
    })

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

  // Set SVG dimensions based on viewBox so 1 unit = 1 pixel
  const topSvgEl = topSvg.querySelector('svg')
  if (topSvgEl) {
    const viewBox = topSvgEl.getAttribute('viewBox')
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+/).map(Number)
      topSvgEl.style.width = `${w}px`
      topSvgEl.style.height = `${h}px`
    }
  }

  const bottomSvgEl = bottomSvg.querySelector('svg')
  if (bottomSvgEl) {
    const viewBox = bottomSvgEl.getAttribute('viewBox')
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+/).map(Number)
      bottomSvgEl.style.width = `${w}px`
      bottomSvgEl.style.height = `${h}px`
    }
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
  scale = Math.max(scale / 1.25, minScale)
  updateTransform()
  updateZoomLevel()
})

resetBtn.addEventListener('click', () => {
  fitToScreen()
})

function updateTransform() {
  svgContainer.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px)) scale(${scale})`
}

function updateZoomLevel() {
  zoomLevel.textContent = `${Math.round(scale * 100)}%`
}

// Fit PCB to screen with 5% margin
function fitToScreen() {
  const svgEl = currentView === 'top'
    ? topSvg.querySelector('svg')
    : bottomSvg.querySelector('svg')

  if (!svgEl) return

  // Get SVG's natural dimensions from viewBox (in gerber units)
  const viewBox = svgEl.getAttribute('viewBox')
  if (!viewBox) return

  const [, , svgWidth, svgHeight] = viewBox.split(/\s+/).map(Number)

  // Get viewer dimensions
  const viewerRect = viewer.getBoundingClientRect()

  // Calculate scale to fit with 5% margin (95% of viewer)
  const margin = 0.95
  const scaleX = (viewerRect.width * margin) / svgWidth
  const scaleY = (viewerRect.height * margin) / svgHeight
  scale = Math.min(scaleX, scaleY)

  // Set minimum scale to fitted scale (can't zoom out past full board view)
  minScale = scale

  // Reset pan to center
  panX = 0
  panY = 0

  updateTransform()
  updateZoomLevel()
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
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
  scale = Math.max(minScale, Math.min(10, scale * zoomFactor))
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
    scale = Math.max(minScale, Math.min(10, scale * scaleFactor))
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
    scale = Math.max(scale / 1.25, minScale)
    updateTransform()
    updateZoomLevel()
  } else if (e.key === '0') {
    fitToScreen()
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
