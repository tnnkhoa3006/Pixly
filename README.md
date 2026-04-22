# 🎨 Pixly - Professional Pixel Art & Animation Editor

Pixly is a powerful, web-based (and desktop-ready) pixel art editor designed for creators who need precision, layering, and advanced animation tools. Built with a focus on high-performance rendering and a premium user experience.

---

## ✨ Key Features

### 🖌️ Professional Drawing Tools
- **Advanced Brushes:** Brush, Eraser, and Paint Bucket.
- **Geometry Tools:** Draw perfect Lines, Rectangles, and Circles.
- **Pixel-Perfect Accuracy:** Real-time grid snapping and coordinate tracking.
- **Eyedropper:** Quickly sample colors from any layer.

### 📚 Layer-Based Architecture
- **Non-Destructive Editing:** Work with multiple layers to isolate different parts of your art.
- **Independent Transforms:** Every layer has its own `X/Y` position, `Rotation`, and `Scale`.
- **Multi-Layer Selection:** Select and transform multiple layers simultaneously for complex movements.
- **Layer Management:** Toggle visibility, adjust opacity, and delete layers with ease.

### 🎞️ Powerful Animation System
- **Frame-by-Frame Control:** Easily add, duplicate, and manage animation frames.
- **Onion Skinning:** View previous frames as a ghost overlay to ensure smooth motion.
- **Variable Duration:** Set custom timing for each individual frame.
- **Real-Time Preview:** Play back your animation directly in the workspace.
- **GIF Export:** Export your creations as high-quality animated GIFs.

### 🚀 Modern UI/UX
- **Smooth Navigation:** Pan and zoom the canvas with fluid responsiveness.
- **Premium Aesthetics:** Sleek dark mode, modern typography (Outfit), and intuitive toolbars.
- **Cross-Platform:** Runs in any modern browser or as a native desktop application via Tauri.

---

## 🛠️ Technology Stack

- **Frontend:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Desktop Bridge:** [Tauri v2](https://tauri.app/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Styling:** Custom Vanilla CSS (Premium design system)

---

## 🚦 Getting Started

### 📦 Installation
```bash
# Clone the repository
git clone https://github.com/tnnkhoa3006/Pixly.git

# Navigate to the project directory
cd Pixly

# Install dependencies
npm install
```

### 💻 Development
#### Web Version
```bash
npm run dev
```

#### Desktop Version (Tauri)
```bash
npm run tauri:dev
```

### 🏗️ Build
#### Web Production
```bash
npm run build
```

#### Desktop Binary
```bash
npm run tauri:build
```

---

## 📜 License
This project is licensed under the MIT License.

---
Made with ❤️ for pixel artists everywhere.
