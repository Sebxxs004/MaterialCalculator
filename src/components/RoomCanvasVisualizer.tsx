import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { Espacio, PVCConfig, ResultadoConsolidado, Orientacion } from '../types/material';
import { obtenerVerticesDeEspacio } from '../helpers/pvcOptimizerEngine';
import { Compass, RotateCw } from 'lucide-react';

interface RoomCanvasVisualizerProps {
  espacio: Espacio;
  config: PVCConfig;
  resultadoConsolidado: ResultadoConsolidado | null;
  onOrientacionChange: (nuevaOrientacion: Orientacion) => void;
  hoveredCorteId: string | null;
  onHoverCorte: (id: string | null) => void;
}

export interface RoomCanvasVisualizerRef {
  captureCanvasSnapshot: () => string;
}

export const RoomCanvasVisualizer = forwardRef<RoomCanvasVisualizerRef, RoomCanvasVisualizerProps>(
  ({ espacio, config, resultadoConsolidado, onOrientacionChange, hoveredCorteId, onHoverCorte }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    // Expose capture snapshot function to parent components
    useImperativeHandle(ref, () => ({
      captureCanvasSnapshot() {
        const canvas = canvasRef.current;
        return canvas ? canvas.toDataURL('image/png') : '';
      },
    }));

    useEffect(() => {
      draw();
    }, [espacio, config, resultadoConsolidado, hoveredCorteId]);

    const getDrawingParameters = (canvas: HTMLCanvasElement) => {
      const vertices = obtenerVerticesDeEspacio(espacio);
      const xs = vertices.map(v => v.x);
      const ys = vertices.map(v => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const ancho = maxX - minX;
      const largo = maxY - minY;

      const padding = 60;
      const drawAreaW = canvas.width - padding * 2;
      const drawAreaH = canvas.height - padding * 2;
      const scale = Math.min(drawAreaW / (ancho || 1), drawAreaH / (largo || 1));

      const w = ancho * scale;
      const h = largo * scale;
      const startX = (canvas.width - w) / 2;
      const startY = (canvas.height - h) / 2;

      return { vertices, minX, minY, scale, startX, startY };
    };

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { vertices, minX, minY, scale, startX, startY } = getDrawingParameters(canvas);

      // 1. Clear background
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Draw Room cuts and sheets (Polygons)
      ctx.save();
      // Clip inside room boundaries
      ctx.beginPath();
      vertices.forEach((v, idx) => {
        const px = startX + (v.x - minX) * scale;
        const py = startY + (v.y - minY) * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.clip();

      if (resultadoConsolidado) {
        // Find all cuts belonging to this space
        const cortesEspacio = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
          lamina.cortes
            .filter(c => c.espacioId === espacio.id)
            .map(c => ({
              ...c,
              isShared: new Set(lamina.cortes.map(x => x.espacioId)).size > 1,
              isFirstInLamina: lamina.cortes[0].id === c.id
            }))
        );

        cortesEspacio.forEach((corte) => {
          if (!corte.poligonoRecortado || corte.poligonoRecortado.length === 0) return;

          // Color coding
          let fillStyle = 'rgba(99, 102, 241, 0.4)'; // Default Soft Blue (New)
          let strokeStyle = 'rgba(129, 140, 248, 0.8)';
          let lineWidth = 1;
          
          if (corte.isShared && !corte.isFirstInLamina) {
            fillStyle = 'rgba(16, 185, 129, 0.45)';
            strokeStyle = 'rgba(52, 211, 153, 0.8)';
          } else if (corte.largo < 1.5 && !corte.isShared) {
            fillStyle = 'rgba(245, 158, 11, 0.45)';
            strokeStyle = 'rgba(251, 191, 36, 0.8)';
          }

          // Shading effect on Hover
          if (corte.id === hoveredCorteId) {
            fillStyle = 'rgba(255, 255, 255, 0.75)'; // White highlight
            strokeStyle = '#ffffff'; // White border
            lineWidth = 2.5;
          }

          ctx.fillStyle = fillStyle;
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = lineWidth;

          // Draw the irregular cut polygon
          corte.poligonoRecortado.forEach((ring) => {
            if (ring.length < 3) return;
            ctx.beginPath();
            ring.forEach((pt, idx) => {
              const px = startX + (pt[0] - minX) * scale;
              const py = startY + (pt[1] - minY) * scale;
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          });
        });
      }

      ctx.restore();

      // 3. Draw outer border of room (Muros)
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      vertices.forEach((v, idx) => {
        const px = startX + (v.x - minX) * scale;
        const py = startY + (v.y - minY) * scale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();

      // 4. Draw dimensions / annotations
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      vertices.forEach((v1, idx) => {
        const v2 = vertices[(idx + 1) % vertices.length];
        const dist = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));

        if (dist < 0.1) return;

        const mx = startX + ((v1.x + v2.x) / 2 - minX) * scale;
        const my = startY + ((v1.y + v2.y) / 2 - minY) * scale;

        const dx = v2.x - v1.x;
        const dy = v2.y - v1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / (len || 1); 
        const ny = dx / (len || 1);

        const tx = mx + nx * 14;
        const ty = my + ny * 14;

        ctx.fillText(`${dist.toFixed(2)} m`, tx, ty);
      });
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !resultadoConsolidado) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);

      const { minX, minY, scale, startX, startY } = getDrawingParameters(canvas);

      // Find all cuts belonging to this space
      const cortesEspacio = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
        lamina.cortes.filter(c => c.espacioId === espacio.id)
      );

      let foundId: string | null = null;

      for (const corte of cortesEspacio) {
        if (!corte.poligonoRecortado) continue;
        let inside = false;

        for (const ring of corte.poligonoRecortado) {
          if (ring.length < 3) continue;

          ctx.beginPath();
          ring.forEach((pt, idx) => {
            const px = startX + (pt[0] - minX) * scale;
            const py = startY + (pt[1] - minY) * scale;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();

          if (ctx.isPointInPath(mouseX, mouseY)) {
            inside = true;
            break;
          }
        }

        if (inside) {
          foundId = corte.id;
          break;
        }
      }

      if (foundId !== hoveredCorteId) {
        onHoverCorte(foundId);
      }
    };

    const handleMouseLeave = () => {
      onHoverCorte(null);
    };

    const toggleOrientacion = () => {
      const actual = espacio.orientacionSeleccionada;
      let siguiente: Orientacion = 'auto';
      if (actual === 'auto') siguiente = 'largo';
      else if (actual === 'largo') siguiente = 'ancho';
      else siguiente = 'auto';
      onOrientacionChange(siguiente);
    };

    const getOrientacionLabel = () => {
      switch (espacio.orientacionSeleccionada) {
        case 'auto': return 'Automático';
        case 'largo': return 'A lo Largo';
        case 'ancho': return 'A lo Ancho';
      }
    };

    return (
      <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col items-center w-full">
        <div className="flex items-center justify-between w-full mb-4">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-400" />
            Diseño: {espacio.nombre}
          </h2>
          
          <button
            type="button"
            onClick={toggleOrientacion}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-300 font-semibold rounded-lg transition-all cursor-pointer hover:text-slate-100"
            title="Cambiar orientación de corte"
          >
            <RotateCw className="w-3 h-3 text-indigo-400" />
            Orientación: {getOrientacionLabel()}
          </button>
        </div>

        <div className="relative w-full aspect-square max-w-[280px] rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-full h-full object-contain cursor-crosshair"
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 justify-center w-full text-[10px] text-slate-400 border-t border-slate-800/60 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600/60 border border-indigo-400/80"></span>
            <span>Lámina Nueva</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600/60 border border-emerald-400/80"></span>
            <span>Retal Reutilizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600/60 border border-amber-400/80"></span>
            <span>Sobrante/Corte Chico</span>
          </div>
        </div>
      </div>
    );
  }
);

RoomCanvasVisualizer.displayName = 'RoomCanvasVisualizer';
