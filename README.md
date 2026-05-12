# Pixly - Trình chỉnh sửa Pixel Art & Animation chuyên nghiệp

Pixly là ứng dụng chỉnh sửa pixel art và hoạt ảnh frame-by-frame, chạy được trên cả trình duyệt web lẫn desktop native (qua Tauri v2). Dự án hướng đến trải nghiệm mượt mà, công cụ vẽ mạnh mẽ và hệ thống animation linh hoạt cho nghệ sĩ pixel.

---

## Mục lục

- [Tính năng nổi bật](#tính-năng-nổi-bật)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt)
- [Sử dụng](#sử-dụng)
- [Phím tắt](#phím-tắt)
- [Xuất / Nhập file](#xuất--nhập-file)
- [Cấu hình](#cấu-hình)
- [CI/CD](#cicd)
- [License](#license)

---

## Tính năng nổi bật

### Công cụ vẽ

| Công cụ | Mô tả |
|---------|--------|
| Brush | Vẽ tự do với kích thước tuỳ chỉnh (1–128 px) |
| Eraser | Xoá pixel |
| Paint Bucket | Tô màu vùng liền kề (flood fill) |
| Line / Rectangle / Circle | Vẽ hình học chính xác (thuật toán Bresenham, midpoint circle) |
| Eyedropper | Lấy màu trực tiếp từ canvas |
| Lighten / Darken | Chỉnh sáng tối dựa trên HSL |
| Spray | Tạo hiệu ứng loang ngẫu nhiên |
| Text | Chèn văn bản với font pixel 5x5 tích hợp |
| Custom Brush | Tuỳ chỉnh brush với các preset sẵn (star, cross, checkered...) |

### Hệ thống Layer

- Nhiều layer trên mỗi frame, mỗi layer có tuỳ chỉnh riêng: vị trí X/Y, xoay, scale
- Tuỳ chỉnh visibility, opacity, tên layer
- Chọn nhiều layer cùng lúc để transform hàng loạt
- Kéo thả sắp xếp thứ tự layer

### Animation

- Thêm / xoá / nhân bản / sắp xếp frame
- Tuỳ chỉnh thời lượng từng frame (millisecond)
- Onion skinning: hiển thị mờ các frame liền kề (tối đa 3 frame trước/sau)
- Phát animation trực tiếp trên canvas
- Chế độ toàn màn hình để preview
- Timeline panel (kiểu Unity) với zoom, kéo thả, playback head
- Xuất GIF chất lượng cao (encoder GIF89a tự xây dựng, không phụ thuộc thư viện ngoài)

### Quản lý dự án

- Định dạng file `.pixly` riêng (JSON, version 1)
- Lưu / mở file qua hộp thoại native (Tauri) hoặc fallback trình duyệt
- Auto-save với cơ chế chống hỏng file (lưu kép)
- Theo dõi 10 file mở gần nhất

### Giao diện

- Màn hình chào mừng với preset dự án, file gần đây, tuỳ chỉnh kích thước canvas
- Hệ thống tab: mở nhiều dự án cùng lúc
- Hướng dẫn onboarding (spotlight tour) cho người mới
- Splash screen với animation (chỉ trên desktop)
- Kiểm tra cập nhật tự động
- Dark theme với thiết kế indigo/violet
- Thanh bên có thể kéo thay đổi kích thước
- Bật/tắt lưới, zoom (chuột + bàn phím), kéo canvas (giữ Space)

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| UI Framework | React 19 + TypeScript 6 |
| Build Tool | Vite 8 |
| State Management | Zustand 5 (slice pattern) |
| Desktop Bridge | Tauri v2 (Rust backend) |
| Icons | Lucide React |
| Animated Backgrounds | Vanta |
| Styling | Custom CSS (~4500 dòng, CSS custom properties) |
| Font | Outfit (Google Fonts) |

---

## Cấu trúc dự án

```
pixel-tool/
├── .github/workflows/          # CI/CD
│   ├── release.yml              # Build Windows khi push tag v*
│   └── build-ios.yml            # Build iOS simulator khi push main
├── src-tauri/                   # Backend Tauri (Rust)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   └── lib.rs               # Tauri app builder, command complete_splash
│   ├── capabilities/            # Quyền hạn Tauri plugins
│   ├── icons/                   # Icons cho các nền tảng
│   ├── Cargo.toml               # Dependencies Rust
│   └── tauri.conf.json          # Cấu hình Tauri
├── src/                         # Frontend
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component
│   ├── types.ts                 # Định nghĩa kiểu dữ liệu
│   ├── index.css                # Design system CSS
│   ├── constants/               # APP_NAME, APP_VERSION
│   ├── store/                   # Zustand store (8 slices)
│   │   └── slices/
│   │       ├── uiSlice.ts       # Trạng thái UI
│   │       ├── canvasSlice.ts   # Zoom/pan canvas
│   │       ├── animationSlice.ts# Frame, layer, animation
│   │       ├── drawingSlice.ts  # Công cụ vẽ, màu, brush
│   │       ├── selectionSlice.ts# Selection, clipboard, flip
│   │       ├── undoRedoSlice.ts # Undo/redo
│   │       ├── fileSlice.ts     # File path, dirty state
│   │       └── tabSlice.ts      # Multi-tab
│   ├── hooks/                   # Custom hooks
│   │   ├── useCanvasApp.ts      # Logic chính (~1400 dòng)
│   │   ├── usePlayback.ts       # Điều khiển phát animation
│   │   ├── useAppUpdater.ts     # Kiểm tra cập nhật
│   │   └── useSidebarResize.ts  # Kéo thay đổi kích thước sidebar
│   ├── components/
│   │   ├── canvas/              # Canvas, PreviewCanvas, CanvasWorkspace
│   │   ├── ui/                  # Sidebar, BottomBar, TabBar, Dialog...
│   │   ├── menu/                # MenuBar (File, Edit, View, Animation, Help)
│   │   ├── timeline/            # Timeline animation
│   │   └── animation/           # AnimationView toàn màn hình
│   └── lib/                     # Các hàm tiện ích
│       ├── drawing.ts           # Rasterization (line, rect, circle)
│       ├── gifExport.ts         # GIF encoder (LZW, zero dependency)
│       ├── imageExport.ts       # Xuất PNG/JPG/BMP/WebP
│       ├── imageImport.ts       # Nhập ảnh vào pixel grid
│       ├── projectFile.ts       # Đọc/ghi file .pixly
│       ├── autoSave.ts          # Auto-save + file gần đây
│       ├── pixelFont.ts         # Font pixel 5x5
│       └── ...helpers.ts        # Các hàm hỗ trợ khác
├── public/                      # Static assets (favicon, icons)
├── package.json
├── vite.config.ts
├── tsconfig.json
└── eslint.config.js
```

---

## Hướng dẫn cài đặt

### Yêu cầu

- **Node.js** v20 trở lên
- **npm** (đi kèm Node.js)
- **Rust toolchain** (chỉ cần khi build desktop) — cài tại [rustup.rs](https://rustup.rs/)

### Cài đặt dependencies

```bash
cd pixel-tool
npm install
```

### Chạy phát triển

**Web (trình duyệt):**

```bash
npm run dev
```

Mở tại `http://localhost:5173`

**Desktop (Tauri):**

```bash
npm run tauri:dev
```

Chạy đồng thời Vite dev server và build Rust. Cửa sổ desktop sẽ tự mở.

### Build sản phẩm

**Web:**

```bash
npm run build
```

Thực thi `tsc -b && vite build`, output vào thư mục `dist/`.

**Desktop:**

```bash
npm run tauri:build
```

Tạo file cài đặt nền tảng kèm updater artifacts.

### Kiểm tra code

```bash
npm run lint
```

---

## Sử dụng

### Menu chính

| Menu | Các mục |
|------|---------|
| **File** | New Project, Open, Import Image, Save, Save As, Export GIF, Export Frame |
| **Edit** | Undo, Redo, Clear Canvas |
| **View** | Toggle Left/Right Toolbar, Grid, Onion Skin |
| **Animation** | Toggle Animation Mode, Play/Pause, Add/Duplicate/Delete Frame |
| **Help** | Check for Updates, About |

### Workflow cơ bản

1. **Tạo dự án mới** — Chọn kích thước canvas từ preset hoặc tuỳ chỉnh trên màn hình Welcome
2. **Vẽ** — Chọn công cụ từ thanh bên trái, chọn màu từ thanh dưới
3. **Quản lý layer** — Thêm / xoá / sắp xếp layer ở thanh bên phải
4. **Animation** — Bật Animation Mode, thêm frame, tuỳ chỉnh thời lượng, sử dụng onion skinning
5. **Xuất** — Export frame (PNG/JPG/BMP/WebP) hoặc export animation (GIF)

---

## Phím tắt

### Công cụ vẽ

| Phím | Chức năng |
|------|-----------|
| `B` | Brush |
| `E` | Eraser |
| `G` | Paint Bucket (Fill) |
| `I` | Eyedropper |
| `L` | Line |
| `R` | Rectangle |
| `C` | Circle |
| `S` | Selection |
| `M` | Move |
| `D` | Lighten |
| `Shift+D` | Darken |
| `A` | Spray |
| `T` | Text |

### File & Edit

| Phím | Chức năng |
|------|-----------|
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open |
| `Ctrl+I` | Import Image |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+C` | Copy selection |
| `Ctrl+X` | Cut selection |
| `Ctrl+V` | Paste selection |
| `Delete` | Xoá selection |

### Export

| Phím | Chức năng |
|------|-----------|
| `Ctrl+E` | Export GIF |
| `Ctrl+Shift+E` | Export Frame |

### Canvas

| Phím | Chức năng |
|------|-----------|
| `+` / `-` | Zoom in/out |
| `Space` (giữ) | Kéo canvas (pan) |
| `Space` (khi đang ở Animation Mode) | Play/Pause |
| `Escape` | Commit selection hoặc xoá custom brush |

---

## Xuất / Nhập file

### Định dạng dự án

- **`.pixly`** — Định dạng riêng dựa trên JSON (version 1), lưu toàn bộ frame, layer, cài đặt animation

### Nhập ảnh

Hỗ trợ: PNG, JPG, BMP, GIF

Ảnh được chuyển sang pixel grid với nearest-neighbor downscaling, giữ nguyên tỉ lệ khung hình.

### Xuất

| Định dạng | Loại |
|-----------|------|
| PNG, JPG, BMP, WebP | Xuất frame đơn hoặc nhiều frame |
| GIF | Xuất animation với thời lượng tuỳ chỉnh từng frame |

---

## Cấu hình

### Tauri (`src-tauri/tauri.conf.json`)

- **Tên sản phẩm:** Pixly
- **Identifier:** `com.pixly.desktop`
- **Cửa sổ chính:** 1200x800, có thể thay đổi kích thước, căn giữa
- **Splash window:** 720x420, không viền, luôn trên cùng
- **Auto-updater:** Bật, endpoint tại `https://pixly-lokat.vercel.app/api/updater/latest.json`
- **Bundle:** Hỗ trợ tất cả nền tảng

### Vite (`vite.config.ts`)

- Port: 5173 (strict mode)
- Plugin: `@vitejs/plugin-react`

### TypeScript

- Target: ES2023
- Strict mode với kiểm tra unused variables/parameters
- Module resolution: bundler

---

## CI/CD

### Release (`release.yml`)

- **Trigger:** Push tag `v*` (ví dụ: `v0.2.0`)
- **Platform:** Windows (windows-latest)
- **Toolchain:** Node 20 + Rust stable
- **Action:** Build desktop binary, tạo GitHub Release với updater artifacts

### iOS Build (`build-ios.yml`)

- **Trigger:** Push vào nhánh `main`
- **Platform:** macOS (cho iOS simulator)
- **Output:** Binary iOS simulator, đóng gói zip, upload lên GitHub Release

---

## License

Dự án sử dụng giấy phép MIT.
