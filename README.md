# Live XSLT Editor �

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Monaco Editor](https://img.shields.io/badge/Editor-Monaco-blue?logo=visual-studio-code)](https://microsoft.github.io/monaco-editor/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A high-performance, real-time XSLT transformation workstation. Designed for developers who need a fast, reliable, and responsive environment for testing and debugging XSLT stylesheets.

---

## ✨ Key Features

### 🛠️ Professional Code Editing
- **Dual Monaco Editors**: Independent instance for XSLT and XML with full syntax highlighting.
- **Intelligent Error Handling**: Real-time syntax validation with detailed error overlays.
- **Live Transformation**: Changes apply instantly, providing immediate feedback on your logic.

### ⚙️ Dynamic Parameter Management
- **Dedicated Sidebar**: Manage XSLT parameters without touching the code.
- **Interactive UI**: Add, edit, and remove parameters on the fly via a clean, intuitive interface.

### � Fully Responsive Workstation
- **Desktop Grid**: Optimized multi-column layout for large screens with draggable panels.
- **Mobile Optimized**: Switch between editors using a tabbed interface.
- **Drawer System**: Full-screen parameter management for smaller devices.

### � Preview & Export
- **IFrame Preview**: Render HTML outputs directly in an integrated preview window.
- **One-Click Export**: Quickly copy or download your transformed results.

---

## �️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) (Used by VS Code)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Logic**: Native Browser `XSLTProcessor` API
- **Language**: [TypeScript](https://www.typescriptlang.org/)

---

## � Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/vieteri/livexslt.git
    cd livexslt
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Open the App**
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## � Usage Guide

1.  **Select Source**: Use the **XSLT** tab to write your transform logic and the **XML** tab for your source data.
2.  **Add Parameters**: Open the **Parameters** panel (toggle icon) to define variables for your XSLT.
3.  **Refine Logic**: Observe the transformation in the **Output** panel. 
4.  **Integrated Preview**: If your output is HTML/SVG, use the **Preview** toggle in the output panel to see the rendered result.
5.  **Resize Panels**: In desktop view, drag the vertical bars between editors to customize your workspace.

---

## 📂 Project Structure

```text
src/
├── app/            # Next.js App Router & Global Styles
├── components/     # Core UI Components (XSLTEditor, CodeEditor)
├── hooks/          # Custom React Hooks
└── lib/            # Utility functions & XSLT logic
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
