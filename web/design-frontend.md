# Design Frontend — Web Store

> Tài liệu phong cách giao diện (Design System) cho dự án Web Store.
> Lấy cảm hứng từ hệ thiết kế **"Industry"** — phong cách kỹ thuật, tối giản, chuyên nghiệp.

---

## 1. Triết lý thiết kế

| Nguyên tắc | Mô tả |
|---|---|
| **Precision** | Mọi thành phần đều chính xác, có chủ đích — không trang trí thừa. |
| **Flat & Sharp** | Góc vuông (`border-radius: 0`), viền hairline, không bo tròn trừ pill badge. |
| **Monochrome Steel** | Bảng màu xây trên một họ màu thép (steel blue) duy nhất, phân biệt bằng độ sáng/tối. |
| **Data-driven** | Ưu tiên hiển thị dữ liệu đo được, không dùng câu khẩu hiệu hay trang trí rỗng. |
| **Blueprint aesthetic** | Các khung thông tin quan trọng dùng dấu registration ở 4 góc, gợi bản vẽ kỹ thuật. |

---

## 2. Typography

### 2.1 Font Stack

| Vai trò | Font | Fallback | Ghi chú |
|---|---|---|---|
| **Sans (body)** | `Barlow` | `system-ui, -apple-system, sans-serif` | Self-host, bao gồm subset Vietnamese |
| **Heading** | `Barlow Condensed` | `Barlow, system-ui, sans-serif` | Dùng cho tiêu đề, nút, nhãn nổi bật |
| **Monospace** | `JetBrains Mono` | `ui-monospace, SF Mono, Menlo, monospace` | Dùng cho code, nhãn tiết diện, số liệu |

### 2.2 Font Weights

| Token | Weight | Sử dụng |
|---|---|---|
| `regular` | 400 | Body text, mô tả, paragraph |
| `medium` | 500 | Label, caption nhấn, nút secondary |
| `semibold` | 600 | Barlow Condensed heading, nút primary |
| `bold` | 700 | Tiêu đề lớn (h1), giá tiền, số liệu KPI |

### 2.3 Type Scale

```
--text-h1:            22px    line-height: 1.3    tracking: -0.3px
--text-h2:            18px    line-height: 1.3
--text-h2-section:    14px    line-height: 1.4
--text-card-title:    14px    line-height: 1.3
--text-body:          13px    line-height: 1.5
--text-body-compact:  12px    line-height: 1.4
--text-label:         11px    line-height: 1.4
--text-caps:          10px    line-height: 1.4    (uppercase, tracking: 0.5px)
--text-fine:          10px    line-height: 1.4
--text-kpi:           20px    line-height: 1.1
--text-code:          11px    line-height: 1.55
```

### 2.4 Quy tắc sử dụng

- **Heading** (`font-heading`): Dùng `Barlow Condensed` cho tên trang, tiêu đề dialog, label nút chính. Kích thước 20px, chữ hoa hoặc thường tuỳ ngữ cảnh.
- **Section label**: Chữ hoa mono, `9.5–10px`, `tracking: 0.11em`, màu `muted-foreground` — nhịp điệu lặp lại xuyên suốt.
- **Body**: `Barlow 400`, `13px`, `line-height: 1.5`.
- **Giá tiền / KPI**: `Barlow 700`, `20px`, `line-height: 1.1`.

---

## 3. Bảng màu (Color Palette)

### 3.1 Steel Ramp — Màu chủ đạo

Toàn bộ giao diện xây trên một dải màu thép duy nhất, phân biệt bằng lightness.

```
steel-100: #eef6ff   ░░░░░░░░░░░░  Tint nhẹ nhất — nền highlight
steel-200: #d6ebff   ░░░░░░░░░░░   Nền hover nhẹ
steel-300: #b5d9fd   ░░░░░░░░░░    Border nhấn
steel-400: #94bce3   ░░░░░░░░░     Text phụ trên nền tối
steel-500: #749dc4   ░░░░░░░░      Accent trung tính
steel-600: #597ea3   ░░░░░░░       Brand primary (viền, link)
steel-700: #416180   ░░░░░░        Nền nút primary (AA contrast)
steel-800: #2c455d   ░░░░░         Text nhấn trên nền sáng
steel-900: #1d2d3d   ░░░░          Text đậm nhất
```

### 3.2 Neutral Ramp

```
neutral-100: #f5f5f8
neutral-200: #e7e7ea
neutral-300: #d4d4d7
neutral-400: #b7b7ba
neutral-500: #98989b
neutral-600: #7a7a7d
neutral-700: #5d5d60
neutral-800: #424244
neutral-900: #2b2b2d
```

### 3.3 Semantic Colors

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `brand-primary` | `#5980a6` | `#7ba2ca` | Link, viền focus, accent chính |
| `brand-tint` | `#eef6ff` | `rgba(123,162,202,0.16)` | Nền highlight, badge, hover |
| `brand-tint-text` | `#2c455d` | `#a8c3dc` | Text trên nền tint |
| `success` | `#597ea3` | `#7ba2ca` | Trạng thái thành công |
| `danger` | `#a3524d` | `#d98d86` | Lỗi, xoá, cảnh báo nghiêm trọng |
| `warning` | `#8a7250` | `#b09a72` | Cảnh báo |
| `info` | `#749dc4` | `#a8c3dc` | Thông tin, gợi ý |

### 3.4 Surface & Text

#### Light Mode
```
surface-primary:     #f2f2f3   — Nền chính (background)
surface-secondary:   #e9e9ea   — Nền card, sidebar
surface-tertiary:    #dededf   — Nền muted, input
surface-quaternary:  #ececed   — Nền xen kẽ

text-primary:        #1d1f20   — Text chính
text-secondary:      #5d5d60   — Text phụ, mô tả
text-tertiary:       #7a7a7d   — Text nhạt, placeholder
```

#### Dark Mode
```
surface-primary:     #14161a   — Nền chính
surface-secondary:   #1a1d22   — Nền card, sidebar
surface-tertiary:    #23272e   — Nền muted
surface-quaternary:  #0f1114   — Nền chìm nhất

text-primary:        #e7e8ea   — Text chính
text-secondary:      #9a9ca0   — Text phụ
text-tertiary:       #6d7075   — Text nhạt
```

### 3.5 Border

```css
--border-width-hairline: 0.5px;
--border-subtle:    color-mix(in srgb, currentTextPrimary 10%, transparent);
--border-emphasis:  color-mix(in srgb, currentTextPrimary 16%, transparent);
```

> **Lưu ý**: Viền là thành phần quan trọng của hệ Industry. Dùng `border-subtle` cho phân vùng nhẹ, `border-emphasis` cho viền khung nổi bật.

---

## 4. Shape — Hình khối

| Token | Giá trị | Ghi chú |
|---|---|---|
| `radius-sm` | `0px` | Vuông góc hoàn toàn |
| `radius-md` | `0px` | Vuông góc hoàn toàn |
| `radius-lg` | `0px` | Vuông góc hoàn toàn |
| `radius-pill` | `9999px` | Chỉ dùng cho badge, tag, chip |

> **Triết lý**: Hệ Industry là **wireframe — mọi component vuông góc**. Không bo tròn nút, card, input. Duy nhất `pill` cho badge/tag nhỏ.

---

## 5. Spacing Scale

```
tight-1:    4px     — Khoảng cách tối thiểu (icon-text gap)
tight-2:    6px     — Padding nhỏ bên trong chip/badge
tight-3:    8px     — Gap giữa các item trong list dày đặc
medium-1:   10px    — Padding input, card compact
medium-2:   12px    — Gap tiêu chuẩn giữa các phần tử
medium-3:   14px    — Padding card thường
large-1:    18px    — Padding section
large-2:    22px    — Gap giữa các section
large-3:    24px    — Margin ngoài lớn
```

---

## 6. Shadow & Elevation

Hệ Industry **hạn chế shadow**. Chỉ dùng khi thật sự cần phân tách lớp:

```css
/* Dialog / Popover — nổi trên overlay */
box-shadow: 0 18px 48px -16px rgba(0, 0, 0, 0.6);

/* Controls nhỏ (minimap, toolbar nổi) */
box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.35);

/* Tooltip */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
```

> Card, sidebar, header: **không shadow** — phân tách bằng viền hairline và sắc độ nền.

---

## 7. Component Patterns

### 7.1 Button

| Variant | Style |
|---|---|
| **Primary** | `bg: steel-700` · `text: surface-primary` · vuông góc · `font-heading` |
| **Secondary** | `bg: surface-secondary` · `text: text-primary` · viền hairline |
| **Ghost** | Trong suốt · hover → `bg: brand-tint` |
| **Outline** | Viền `border-subtle` · hover → nền accent nhẹ |
| **Destructive** | `bg: danger` · `text: white` |
| **Link** | Không nền · `text: brand-primary` · `underline` on hover |

**Kích thước nút**:
```
xs:  h-24px  px-8px   text-xs
sm:  h-32px  px-12px
md:  h-36px  px-16px  (default)
lg:  h-40px  px-24px
```

### 7.2 Card

```
- Nền: surface-primary (light) / surface-secondary (dark)
- Viền: border-subtle (1px hoặc hairline 0.5px)
- Góc: vuông (0px radius)
- Padding: 14–18px
- Không shadow
- Blueprint corners (tuỳ chọn) cho card quan trọng
```

### 7.3 Input / Form Control

```
- Nền: transparent hoặc surface-tertiary
- Viền: border-subtle, focus → border: brand-primary
- Ring focus: brand-primary (2px)
- Góc: vuông
- Font: Barlow 400, 13px
- Placeholder: text-tertiary
```

### 7.4 Dialog / Modal

```
- Overlay: black/50
- Nền: surface-primary (border 1px)
- Góc: vuông
- Shadow: 0 18px 48px -16px rgba(0,0,0,0.6)
- Blueprint corners: có (4 dấu registration ở góc)
- Title: font-heading, 20px
- Description: 12.5px, text-muted-foreground
```

### 7.5 Page Header

```
- Chiều cao cố định: 52px
- Viền dưới: border-subtle
- Layout: [SectionLabel (mono caps)] / [Title (heading 20px)] / [Meta (mono)] → [Actions]
- SectionLabel: uppercase, mono, 9.5px, tracking 0.1em
```

### 7.6 Section Label (nhãn tiết diện)

```css
font-family: monospace;
font-size: 9.5px;
text-transform: uppercase;
letter-spacing: 0.11em;
color: var(--text-tertiary);
```

> Đây là motif lặp lại quan trọng nhất của hệ Industry — dùng ở header, sidebar, card header, form section.

### 7.7 Badge / Chip / Tag

```
- Nền: color-mix(in srgb, dotColor 15%, transparent)
- Text: tông đậm tương ứng
- Dot: chấm tròn nhỏ 6–8px cùng màu dotColor
- Góc: pill (9999px) — ngoại lệ duy nhất cho radius
- Font: 11px, medium weight
```

---

## 8. Scrollbar

```css
scrollbar-width: thin;
scrollbar-color: textTertiary/45% transparent;

/* Webkit */
::-webkit-scrollbar         { width: 10px; height: 10px; }
::-webkit-scrollbar-track   { background: transparent; }
::-webkit-scrollbar-thumb   { 
  background: textTertiary/40%;
  border: 2px solid transparent;
  border-radius: 8px;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover { background: textTertiary/66%; }
```

---

## 9. Animation & Motion

| Hiệu ứng | Cách dùng | Thời lượng |
|---|---|---|
| **Transition mặc định** | `transition-colors` trên hover/focus | `150–200ms ease` |
| **Dialog enter** | `fade-in` | `200ms` |
| **Pulse (loading)** | `box-shadow` pulse nhịp | `1.4s ease-out infinite` |
| **Indeterminate bar** | Thanh progress chạy ngang | `1.1s ease-in-out infinite` |

> **Nguyên tắc**: Ít animation, ngắn gọn. Tôn trọng `prefers-reduced-motion: reduce` — tắt hết animation.

---

## 10. Responsive & Layout

```
- Mobile-first nhưng giao diện tối ưu cho desktop (≥1024px)
- Sidebar: nền surface-secondary, viền phải border-subtle
- Content: nền surface-primary
- Header: 52px cố định, border-bottom
- Grid sản phẩm: CSS Grid, auto-fill, minmax(240px, 1fr)
- Gap: 12–18px tuỳ mật độ
```

---

## 11. Icon

```
- Thư viện: Lucide React (outline, 1.5px stroke)
- Size mặc định: 16px (size-4)
- Color: currentColor (thừa hưởng từ text)
- Trong nút: shrink-0, pointer-events-none
```

---

## 12. Dark Mode

- Chuyển đổi bằng class `.dark` trên root
- Hỗ trợ `system` (theo OS preference)
- **Không đảo ngược màu** — dùng bộ token riêng cho dark (xem mục 3.4)
- Brand primary sáng hơn trong dark (`#7ba2ca` thay vì `#5980a6`)
- Border dùng `rgba(white, 0.1)` thay vì `rgba(black, 0.1)`

---

## 13. Tổng kết phong cách

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ▸ Vuông góc · Hairline borders · Không shadow         │
│   ▸ Mono-steel palette · Một họ màu duy nhất            │
│   ▸ Barlow + Barlow Condensed · Self-hosted              │
│   ▸ Blueprint corners cho khung quan trọng               │
│   ▸ Section labels: UPPERCASE MONO 9.5px                 │
│   ▸ Data-first · Không trang trí thừa                    │
│   ▸ Dark/Light qua CSS variables                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 14. CSS Variables Reference (copy-paste)

```css
:root {
  /* Font */
  --font-sans: Barlow, system-ui, -apple-system, sans-serif;
  --font-heading: 'Barlow Condensed', Barlow, system-ui, sans-serif;
  --font-mono: ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, monospace;

  /* Steel ramp */
  --steel-100: #eef6ff;
  --steel-200: #d6ebff;
  --steel-300: #b5d9fd;
  --steel-400: #94bce3;
  --steel-500: #749dc4;
  --steel-600: #597ea3;
  --steel-700: #416180;
  --steel-800: #2c455d;
  --steel-900: #1d2d3d;

  /* Brand */
  --brand-primary: #5980a6;
  --brand-tint: #eef6ff;
  --brand-tint-text: #2c455d;

  /* Surfaces */
  --surface-primary: #f2f2f3;
  --surface-secondary: #e9e9ea;
  --surface-tertiary: #dededf;

  /* Text */
  --text-primary: #1d1f20;
  --text-secondary: #5d5d60;
  --text-tertiary: #7a7a7d;

  /* Border */
  --border-subtle: color-mix(in srgb, #1d1f20 10%, transparent);
  --border-emphasis: color-mix(in srgb, #1d1f20 16%, transparent);

  /* Status */
  --success: #597ea3;
  --danger: #a3524d;
  --warning: #8a7250;
  --info: #749dc4;

  /* Shape */
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --radius-pill: 9999px;

  /* Spacing */
  --space-tight-1: 4px;
  --space-tight-2: 6px;
  --space-tight-3: 8px;
  --space-medium-1: 10px;
  --space-medium-2: 12px;
  --space-medium-3: 14px;
  --space-large-1: 18px;
  --space-large-2: 22px;
  --space-large-3: 24px;
}
```
