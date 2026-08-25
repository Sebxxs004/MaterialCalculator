# MaterialCalculator

**MaterialCalculator** es una aplicación web avanzada e interactiva desarrollada en **React + TypeScript** y estilizada con **Tailwind CSS v4** para calcular, presupuestar y optimizar la distribución de cortes de láminas de cielo raso en PVC (cielorraso).

## 🚀 Características Clave

1. **Configuración Dinámica de Material**: Define el largo comercial de las láminas (estándar de 5.95m), el ancho útil (ej. 0.25m) y el precio unitario.
2. **Formulario Dinámico de Espacios**: Permite registrar múltiples habitaciones/ambientes de forma simultánea indicando ancho, largo y orientación de tendido.
3. **Motor de Optimización de Cortes (Bin Packing BFD)**: 
   - Compara y elige automáticamente la orientación de instalación con menor desperdicio para cada habitación.
   - Aplica el algoritmo *Best Fit Decreasing* (Bin Packing) para consolidar los cortes requeridos de todos los ambientes y agruparlos físicamente en el menor número posible de láminas comerciales de fábrica, maximizando la reutilización de retales sobrantes.
4. **Visualización en 2D interactiva (`RoomCanvasVisualizer`)**: Representación a escala sobre un elemento Canvas de HTML5 mostrando marcas de hileras, uniones de corte (líneas discontinuas de contraste) y cotas de medida exteriores.
5. **Visualización en 3D interactiva (`Room3DViewer`)**: 
   - Modelado en tiempo real con **React Three Fiber (R3F) y Three.js**.
   - Muros perimetrales translúcidos, molduras (perfil J), e iluminación cenital con focos dicroicos empotrados.
   - Selector de acabados realistas (Blanco Clásico, Madera Cálida y Grafito Mate) y alternador de estructura metálica de soporte (Perfiles Omega).
6. **Administración y Persistencia (`ProjectHistoryModal`)**: Almacenamiento local mediante `IndexedDB` nativo (sin dependencias adicionales), permitiendo guardar capturas base64 del canvas, estadísticas de compra y realizar cargas rápidas para ediciones en caliente.
7. **Guía de Obra y Exportación a PDF (`MasterCuttingSheet`)**: Barra de corte física para taller y botón de descarga de un reporte técnico con planos A4 imprimibles utilizando `jsPDF` y `html2canvas`.

---

## 🛠️ Stack Tecnológico

- **Framework**: React 19 (Vite)
- **Lenguaje**: TypeScript
- **Estilizado**: Tailwind CSS v4 (con soporte para Dark Mode moderno, fuentes Outfit y Glassmorphism)
- **Modelado 3D**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Generación de Reportes**: `jspdf`, `html2canvas`
- **Base de Datos Local**: `IndexedDB` (API nativa de almacenamiento)
- **Iconografía**: `lucide-react`

---

## 📂 Estructura del Código

```bash
src/
├── assets/           # Recursos estáticos
├── components/       # Componentes de UI modulares
│   ├── EspaciosForm.tsx          # Formulario dinámico de ambientes
│   ├── HistorialProyectos.tsx    # Listado rápido del historial
│   ├── MasterCuttingSheet.tsx    # Plan de corte de fábrica & PDF export
│   ├── ProjectHistoryModal.tsx   # Modal administrador de historial en IndexedDB
│   ├── PVCConfigForm.tsx         # Configuración del material comercial
│   └── RoomCanvasVisualizer.tsx  # Renderizador HTML5 Canvas 2D
├── helpers/          # Lógica computacional
│   └── pvcOptimizerEngine.ts     # Motor de optimización de cortes (BFD)
├── services/         # Servicios persistentes
│   └── projectStorageService.ts  # Capa de almacenamiento en IndexedDB
├── types/            # Interfaces de TypeScript
│   └── material.ts               # Declaraciones de tipos y esquemas
├── App.tsx           # Dashboard principal y flujo de estado
├── index.css         # Estilos globales y tokens Tailwind v4
└── main.tsx          # Punto de entrada
```

---

## 💻 Instalación y Desarrollo

Sigue estos pasos para ejecutar la aplicación de forma local:

### Prerrequisitos
- Node.js (v18 o superior recomendado)
- npm o yarn

### 1. Clonar el repositorio e instalar dependencias
```bash
npm install
```

### 2. Levantar el servidor de desarrollo
```bash
npm run dev
```
Abre tu navegador en `http://localhost:5173` para visualizar la aplicación.

### 3. Compilar para producción
Para generar el bundle optimizado y verificar el tipado estricto de TypeScript:
```bash
npm run build
```
Los archivos de distribución se generarán en la carpeta `dist/`.

---

## 🎯 Código de Colores en el Despiece

- 🟦 **Azul Suave**: Pieza principal/nueva cortada directo de una lámina comercial.
- 🟩 **Verde Esmeralda**: Pieza reutilizada (retal sobrante de otra lámina/habitación).
- 🟧 **Naranja Cálido**: Junta de remate corta o sobrante de corte local utilizable.
- ⬛ **Gris Ceniza**: Residuo o desperdicio final sin uso.
