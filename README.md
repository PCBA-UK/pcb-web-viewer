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

**Gerber Files:**
- `.gbr` - Gerber files
- `.gtl` - Top copper
- `.gbl` - Bottom copper
- `.gts` - Top soldermask
- `.gbs` - Bottom soldermask
- `.gto` - Top silkscreen
- `.gbo` - Bottom silkscreen
- `.gtp` - Top paste
- `.gbp` - Bottom paste
- `.gm1`, `.gml`, `.gko` - Board outline
- `.drl`, `.txt` - Drill files (Excellon format)
- `.pho`, `.ger`, `.spl` - Other Gerber formats

> **Note:** `.txt` files are automatically detected as drill files. Pick-and-place files are ignored.

**Archives:**
- `.zip` - ZIP archives
- `.tar` - TAR archives
- `.tar.gz`, `.tgz` - Gzipped TAR archives
- `.7z` - 7-Zip archives
- `.rar` - RAR archives

All archive formats support nested subfolders.

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
3. **Load sample** - Click "Load Sample" to load gerber files from the `sample/` folder
4. **Navigate** - Use mouse wheel to zoom, drag to pan
5. **Switch views** - Click "Top" or "Bottom" to flip the board
6. **Toggle paste** - Check/uncheck "Show Paste Layer" in the Display panel

### Adding Sample Files

Place any Gerber files (`.gbr`, `.gtl`, `.gbl`, `.drl`, etc.) in the `sample/` folder. They will automatically be loaded when you click "Load Sample".

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
