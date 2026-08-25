import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import type { Espacio, PVCConfig, ResultadoConsolidado, Orientacion } from '../types/material';
import { Compass, RotateCw } from 'lucide-react';

interface RoomCanvasVisualizerProps {
  espacio: Espacio;
  config: PVCConfig;
  resultadoConsolidado: ResultadoConsolidado | null;
  onOrientacionChange: (nuevaOrientacion: Orientacion) => void;
}

export interface RoomCanvasVisualizerRef {
  captureCanvasSnapshot: () => string;
}

export const RoomCanvasVisualizer = forwardRef<RoomCanvasVisualizerRef, RoomCanvasVisualizerProps>(
  ({ espacio, config, resultadoConsolidado, onOrientacionChange }, ref) => {
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
    }, [espacio, config, resultadoConsolidado]);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { largo, ancho } = espacio;
      const { anchoUtil } = config;

      // 1. Clear background
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Scale & Center calculations
      const padding = 50;
      const drawAreaW = canvas.width - padding * 2;
      const drawAreaH = canvas.height - padding * 2;
      const scale = Math.min(drawAreaW / ancho, drawAreaH / largo);

      const w = ancho * scale;
      const h = largo * scale;
      const startX = (canvas.width - w) / 2;
      const startY = (canvas.height - h) / 2;

      // Determine orientation
      let orientacionEfectiva = espacio.orientacionSeleccionada;
      if (orientacionEfectiva === 'auto' && resultadoConsolidado) {
        const desglose = resultadoConsolidado.desgloseEspacios.find(d => d.espacioId === espacio.id);
        orientacionEfectiva = desglose?.orientacionElegida || 'largo';
      }
      if (orientacionEfectiva === 'auto') {
        orientacionEfectiva = 'largo';
      }

      // 3. Draw Room cuts and sheets
      ctx.save();
      // Clip inside room boundary
      ctx.beginPath();
      ctx.rect(startX, startY, w, h);
      ctx.clip();

      if (resultadoConsolidado) {
        // Find all cuts belonging to this space
        const cortesEspacio = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
          lamina.cortes
            .filter(c => c.espacioId === espacio.id)
            .map(c => ({
              ...c,
              laminaId: lamina.id,
              isShared: new Set(lamina.cortes.map(x => x.espacioId)).size > 1,
              isFirstInLamina: lamina.cortes[0].id === c.id
            }))
        );

        if (orientacionEfectiva === 'largo') {
          const hileras = Math.ceil(ancho / anchoUtil);
          const panelW = anchoUtil * scale;

          for (let rowIdx = 0; rowIdx < hileras; rowIdx++) {
            const x = startX + rowIdx * panelW;

            // Gather and sort cuts for this specific row
            const cortesHilera = cortesEspacio
              .filter(c => c.hileraIndex === rowIdx)
              .sort((a, b) => b.largo - a.largo);

            let currentY = startY;
            cortesHilera.forEach((corte) => {
              const cutH = corte.largo * scale;

              // Color coding
              let fillStyle = 'rgba(99, 102, 241, 0.4)'; // Default Soft Blue (New)
              let strokeStyle = 'rgba(129, 140, 248, 0.8)';
              
              if (corte.isShared && !corte.isFirstInLamina) {
                // Reused leftover from another space (Green)
                fillStyle = 'rgba(16, 185, 129, 0.45)';
                strokeStyle = 'rgba(52, 211, 153, 0.8)';
              } else if (corte.largo < 1.5 && !corte.isShared) {
                // Small joint leftover/cutoff (Orange)
                fillStyle = 'rgba(245, 158, 11, 0.45)';
                strokeStyle = 'rgba(251, 191, 36, 0.8)';
              }

              ctx.fillStyle = fillStyle;
              ctx.strokeStyle = strokeStyle;
              ctx.lineWidth = 1;
              ctx.fillRect(x + 1, currentY + 1, panelW - 2, cutH - 2);
              ctx.strokeRect(x, currentY, panelW, cutH);

              // Draw dashed line for cut connections
              if (currentY > startY) {
                ctx.save();
                ctx.strokeStyle = '#f43f5e'; // Red dash line for connection joints
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(x, currentY);
                ctx.lineTo(x + panelW, currentY);
                ctx.stroke();
                ctx.restore();
              }

              currentY += cutH;
            });
          }
        } else {
          // Parallel to Width
          const hileras = Math.ceil(largo / anchoUtil);
          const panelH = anchoUtil * scale;

          for (let rowIdx = 0; rowIdx < hileras; rowIdx++) {
            const y = startY + rowIdx * panelH;

            // Gather and sort cuts for this specific row
            const cortesHilera = cortesEspacio
              .filter(c => c.hileraIndex === rowIdx)
              .sort((a, b) => b.largo - a.largo);

            let currentX = startX;
            cortesHilera.forEach((corte) => {
              const cutW = corte.largo * scale;

              // Color coding
              let fillStyle = 'rgba(99, 102, 241, 0.4)'; // Default Soft Blue (New)
              let strokeStyle = 'rgba(129, 140, 248, 0.8)';
              
              if (corte.isShared && !corte.isFirstInLamina) {
                // Reused leftover from another space (Green)
                fillStyle = 'rgba(16, 185, 129, 0.45)';
                strokeStyle = 'rgba(52, 211, 153, 0.8)';
              } else if (corte.largo < 1.5 && !corte.isShared) {
                // Small joint leftover/cutoff (Orange)
                fillStyle = 'rgba(245, 158, 11, 0.45)';
                strokeStyle = 'rgba(251, 191, 36, 0.8)';
              }

              ctx.fillStyle = fillStyle;
              ctx.strokeStyle = strokeStyle;
              ctx.lineWidth = 1;
              ctx.fillRect(currentX + 1, y + 1, cutW - 2, panelH - 2);
              ctx.strokeRect(currentX, y, cutW, panelH);

              // Draw dashed line for cut connections
              if (currentX > startX) {
                ctx.save();
                ctx.strokeStyle = '#f43f5e'; // Red dash line for connection joints
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(currentX, y);
                ctx.lineTo(currentX, y + panelH);
                ctx.stroke();
                ctx.restore();
              }

              currentX += cutW;
            });
          }
        }
      }

      ctx.restore();

      // 4. Draw outer border of room
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 3;
      ctx.strokeRect(startX, startY, w, h);

      // 5. Draw dimensions / annotations (Cotas)
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 12px Outfit, sans-serif';
      ctx.textAlign = 'center';

      // Width Label (at bottom center)
      ctx.fillText(`${ancho.toFixed(2)} m (Ancho)`, canvas.width / 2, startY + h + 24);

      // Length Label (at left side rotated)
      ctx.save();
      ctx.translate(startX - 24, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${largo.toFixed(2)} m (Largo)`, 0, 0);
      ctx.restore();

      // Grid/Row width indicator marker
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.restore();
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
            <RotateCw className="w-3 h-3 text-indigo-400 animate-spin-slow" />
            Orientación: {getOrientacionLabel()}
          </button>
        </div>

        <div className="relative w-full aspect-square max-w-[280px] rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            className="w-full h-full object-contain"
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
