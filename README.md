# PCB Gerber Viewer

A web-based viewer for visualizing PCB Gerber files. Upload your manufacturing files and inspect your board design with ease.

## Features

- **Drag & Drop Upload** - Simply drag Gerber files onto the viewer or click to browse
- **Board Flipping** - Toggle between Top and Bottom views to inspect both sides of the PCB
- **Paste Layer Toggle** - Show/hide solder paste layers for assembly reference
- **Pan & Zoom** - Mouse wheel to zoom, click and drag to pan around the board
- **Touch Support** - Pinch to zoom and drag to pan on touch devices
- **Full Screen Viewer** - Maximum viewing area for detailed inspection

## Supported File Types

- `.gbr` - Gerber files
- `.gtl` - Top copper
- `.gbl` - Bottom copper
- `.gts` - Top soldermask
- `.gbs` - Bottom soldermask
- `.gto` - Top silkscreen
- `.gbo` - Bottom silkscreen
- `.gtp` - Top paste
- `.gbp` - Bottom paste
- `.gm1`, `.gml` - Board outline
- `.drl` - Drill files
- `.txt`, `.pho`, `.ger` - Other Gerber formats

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Open the viewer** - Run `npm run dev` and open http://localhost:5173
2. **Load files** - Drag & drop your Gerber files or click "Browse Files"
3. **Navigate** - Use mouse wheel to zoom, drag to pan
4. **Switch views** - Click "Top" or "Bottom" to flip the board
5. **Toggle paste** - Check/uncheck "Show Paste Layer" in the Display panel

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `T` | Show Top view |
| `B` | Show Bottom view |
| `P` | Toggle paste layer |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset view |
| `O` | Open file dialog |
| `L` | Toggle Display panel |
| `Esc` | Close modal |

## Technology Stack

- [Vite](https://vitejs.dev/) - Build tool
- [pcb-stackup](https://github.com/tracespace/tracespace) - Gerber to SVG conversion
- Vanilla JavaScript, HTML, CSS

## License

MIT
