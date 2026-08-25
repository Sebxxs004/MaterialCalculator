import React, { useState, useRef, useEffect } from 'react';
import type { Espacio, PVCConfig, ResultadoConsolidado } from '../types/material';
import { obtenerVerticesDeEspacio } from '../helpers/pvcOptimizerEngine';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown, Scissors, Loader, X, Info } from 'lucide-react';

interface MasterCuttingSheetProps {
  resultadoConsolidado: ResultadoConsolidado;
  espacios: Espacio[];
  pvcConfig: PVCConfig;
  nombreProyecto: string;
  hoveredCorteId?: string | null;
  onHoverCorte?: (id: string | null) => void;
}

const SEGMENT_COLORS = [
  'bg-indigo-600 border-indigo-500 text-indigo-100',
  'bg-violet-600 border-violet-500 text-violet-100',
  'bg-emerald-600 border-emerald-500 text-emerald-100',
  'bg-amber-600 border-amber-500 text-amber-100',
  'bg-pink-600 border-pink-500 text-pink-100',
  'bg-cyan-600 border-cyan-500 text-cyan-100',
  'bg-rose-600 border-rose-500 text-rose-100',
];

// Helper Static Canvas component to draw plan for any space
const RoomStaticCanvas: React.FC<{
  espacio: Espacio;
  config: PVCConfig;
  resultadoConsolidado: ResultadoConsolidado;
}> = ({ espacio, config, resultadoConsolidado }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vertices = obtenerVerticesDeEspacio(espacio);
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const ancho = maxX - minX;
    const largo = maxY - minY;

    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Padding & scale
    const padding = 35;
    const scale = Math.min((canvas.width - padding * 2) / (ancho || 1), (canvas.height - padding * 2) / (largo || 1));
    const w = ancho * scale;
    const h = largo * scale;
    const startX = (canvas.width - w) / 2;
    const startY = (canvas.height - h) / 2;

    // Clip inside room boundaries
    ctx.save();
    ctx.beginPath();
    vertices.forEach((v, idx) => {
      const px = startX + (v.x - minX) * scale;
      const py = startY + (v.y - minY) * scale;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.clip();

    // Draw cuts
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

      let fillStyle = 'rgba(99, 102, 241, 0.45)';
      let strokeStyle = 'rgba(129, 140, 248, 0.8)';
      
      if (!corte.isFirstInLamina) {
        fillStyle = 'rgba(16, 185, 129, 0.45)';
        strokeStyle = 'rgba(52, 211, 153, 0.8)';
      }

      ctx.fillStyle = fillStyle;
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = 1;

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

    ctx.restore();

    // Draw borders (walls)
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

    // Draw dimensions
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px Outfit, sans-serif';
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

      ctx.fillText(`${dist.toFixed(2)} m`, mx + nx * 12, my + ny * 12);
    });
  }, [espacio, config, resultadoConsolidado]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={240}
      className="w-[240px] h-[240px] rounded-xl border border-slate-800 bg-[#0f172a]"
    />
  );
};

export const MasterCuttingSheet: React.FC<MasterCuttingSheetProps> = ({
  resultadoConsolidado,
  espacios,
  pvcConfig,
  nombreProyecto,
  hoveredCorteId = null,
  onHoverCorte = () => {},
}) => {
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [selectedSegmentInfo, setSelectedSegmentInfo] = useState<{ title: string; desc: string } | null>(null);

  const exportarReportePDF = async () => {
    setGenerandoPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const rootElement = document.getElementById('main-pdf-export-root');
      if (!rootElement) {
        alert('Error: No se pudo localizar el contenedor del reporte.');
        setGenerandoPDF(false);
        return;
      }

      const canvas = await html2canvas(rootElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#070b13',
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style').forEach((styleEl) => {
            let cssText = styleEl.textContent || '';
            cssText = cssText.replace(/oklch\([^)]*\)/gi, '#475569');
            cssText = cssText.replace(/oklab\([^)]*\)/gi, '#334155');
            styleEl.textContent = cssText;
          });

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root {
              --color-slate-50: #f8fafc !important;
              --color-slate-100: #f1f5f9 !important;
              --color-slate-200: #e2e8f0 !important;
              --color-slate-300: #cbd5e1 !important;
              --color-slate-400: #94a3b8 !important;
              --color-slate-500: #64748b !important;
              --color-slate-600: #475569 !important;
              --color-slate-700: #334155 !important;
              --color-slate-800: #1e293b !important;
              --color-slate-900: #0f172a !important;
              --color-slate-950: #020617 !important;

              --color-indigo-50: #e0e7ff !important;
              --color-indigo-100: #c7d2fe !important;
              --color-indigo-400: #818cf8 !important;
              --color-indigo-500: #6366f1 !important;
              --color-indigo-600: #4f46e5 !important;
              --color-indigo-700: #4338ca !important;

              --color-violet-50: #f5f3ff !important;
              --color-violet-100: #ede9fe !important;
              --color-violet-400: #a78bfa !important;
              --color-violet-500: #8b5cf6 !important;
              --color-violet-600: #7c3aed !important;

              --color-emerald-50: #ecfdf5 !important;
              --color-emerald-100: #d1fae5 !important;
              --color-emerald-400: #34d399 !important;
              --color-emerald-500: #10b981 !important;
              --color-emerald-600: #059669 !important;

              --color-amber-50: #fffbeb !important;
              --color-amber-100: #fef3c7 !important;
              --color-amber-400: #fbbf24 !important;
              --color-amber-50: #f59e0b !important;
              --color-amber-600: #d97706 !important;

              --color-pink-50: #fdf2f8 !important;
              --color-pink-100: #fce7f3 !important;
              --color-pink-400: #f472b6 !important;
              --color-pink-500: #ec4899 !important;
              --color-pink-600: #db2777 !important;

              --color-cyan-50: #ecfeff !important;
              --color-cyan-100: #cffafe !important;
              --color-cyan-400: #22d3ee !important;
              --color-cyan-500: #06b6d4 !important;
              --color-cyan-600: #0891b2 !important;

              --color-rose-50: #fff1f2 !important;
              --color-rose-100: #ffe4e6 !important;
              --color-rose-400: #fb7185 !important;
              --color-rose-50: #f43f5e !important;
              --color-rose-600: #e11d48 !important;
            }
          `;
          clonedDoc.head.appendChild(style);

          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            if (el.style) {
              if (el.style.cssText && (el.style.cssText.includes('oklch') || el.style.cssText.includes('oklab'))) {
                el.style.cssText = el.style.cssText
                  .replace(/oklch\([^)]*\)/gi, '#475569')
                  .replace(/oklab\([^)]*\)/gi, '#334155');
              }
              const keys = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
              keys.forEach((key) => {
                const val = (el.style as any)[key];
                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                  if (key === 'color') (el.style as any)[key] = '#cbd5e1';
                  else if (key === 'backgroundColor') (el.style as any)[key] = '#1e293b';
                  else (el.style as any)[key] = '#475569';
                }
              });
            }
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Multi-page handling
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const safeName = nombreProyecto.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`reporte_${safeName}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al generar el PDF.');
    } finally {
      setGenerandoPDF(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl border border-slate-800/80 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Guía de Corte para Taller / Obra</h2>
            <p className="text-xs text-slate-400">Guía de despiece físico paso a paso de las láminas de 5.95m</p>
          </div>
        </div>

        <button
          type="button"
          onClick={exportarReportePDF}
          disabled={generandoPDF}
          className="no-export-pdf flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-700 disabled:to-slate-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
        >
          {generandoPDF ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Exportar Reporte PDF
            </>
          )}
        </button>
      </div>

      {/* Screen layout listing */}
      <div className="space-y-5">
        {resultadoConsolidado.laminasComerciales.map((lamina, index) => {
          const totalUsado = lamina.cortes.reduce((acc, c) => acc + c.largo, 0);
          const totalSobrante = parseFloat((pvcConfig.largoComercial - totalUsado).toFixed(3));
          
          return (
            <div
              key={lamina.id}
              className="bg-slate-900/40 rounded-xl p-4 border border-slate-800/80 hover:border-slate-700/60 transition-all duration-200"
            >
              {/* Sheet header */}
              <div className="flex items-center justify-between text-xs mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 font-semibold rounded border border-indigo-800/40">
                    Lámina #{index + 1}
                  </span>
                  <span className="text-slate-500">
                    ID: {lamina.id}
                  </span>
                </div>
                <span className="text-slate-400 font-medium">
                  Longitud: {totalUsado.toFixed(2)}m usada / {totalSobrante.toFixed(2)}m sobrante
                </span>
              </div>

              {/* Progress bar visual container */}
              <div className="h-9 w-full rounded-lg bg-slate-950 border border-slate-800 flex overflow-hidden">
                {lamina.cortes.map((corte) => {
                  const pct = (corte.largo / pvcConfig.largoComercial) * 100;
                  const espacioIdx = espacios.findIndex(e => e.id === corte.espacioId);
                  const colorClass = SEGMENT_COLORS[espacioIdx % SEGMENT_COLORS.length] || 'bg-indigo-600';
                  
                  const isHovered = corte.id === hoveredCorteId;
                  const esReutilizado = corte.id !== lamina.cortes[0].id;

                  return (
                    <div
                      key={corte.id}
                      style={{ width: `${pct}%` }}
                      onMouseEnter={() => onHoverCorte(corte.id)}
                      onMouseLeave={() => onHoverCorte(null)}
                      onClick={() => {
                        setSelectedSegmentInfo({
                          title: `Corte de ${corte.largo.toFixed(2)}m`,
                          desc: `Este segmento de ${corte.largo.toFixed(2)}m está destinado al espacio "${corte.espacioNombre}" para ser instalado en la Hilera ${corte.hileraIndex + 1}. ${
                            esReutilizado 
                              ? 'Se obtiene cortando a partir del retal restante de esta lámina comercial, reduciendo el desperdicio del proyecto.'
                              : 'Es el primer corte principal realizado a partir de esta lámina nueva.'
                          }`
                        });
                      }}
                      className={`h-full border-r border-slate-950/20 flex flex-col items-center justify-center text-[10px] font-bold px-1 transition-all select-none cursor-pointer duration-150 ${
                        isHovered 
                          ? 'scale-y-110 ring-2 ring-amber-400 brightness-125 z-10 font-black shadow-lg shadow-amber-500/20' 
                          : 'hover:brightness-105'
                      } ${colorClass}`}
                    >
                      <span className="truncate w-full text-center">{corte.largo}m</span>
                      <span className="text-[7.5px] opacity-75 truncate w-full text-center">{corte.espacioNombre}</span>
                    </div>
                  );
                })}

                {totalSobrante > 0 && (
                  <div
                    style={{ width: `${(totalSobrante / pvcConfig.largoComercial) * 100}%` }}
                    onClick={() => {
                      const esSobranteGrande = totalSobrante > 0.05;
                      setSelectedSegmentInfo({
                        title: esSobranteGrande ? `Retal Sobrante de ${totalSobrante.toFixed(2)}m` : `Desperdicio de ${totalSobrante.toFixed(2)}m`,
                        desc: esSobranteGrande
                          ? `Este segmento es el material restante de la lámina después de realizar los cortes requeridos. No se utiliza para ningún corte en el proyecto actual. Al medir ${totalSobrante.toFixed(2)}m, se recomienda guardarlo en tu taller para futuras obras.`
                          : `Este segmento es el residuo sobrante de la lámina. No se puede utilizar en este proyecto y es demasiado corto (${totalSobrante.toFixed(2)}m) para guardarse. Se considera residuo no utilizable.`
                      });
                    }}
                    className={`h-full flex flex-col items-center justify-center text-[10px] font-semibold select-none cursor-pointer hover:brightness-110 ${
                      totalSobrante > 0.05 
                        ? 'bg-amber-600/35 text-amber-200 border-l border-amber-500/20' 
                        : 'bg-rose-950/30 text-rose-400/80'
                    }`}
                  >
                    <span>{totalSobrante}m</span>
                    <span className="text-[7.5px] opacity-75">
                      {totalSobrante > 0.05 ? 'Retal' : 'Desp.'}
                    </span>
                  </div>
                )}
              </div>

              {/* Cut checklist instructions for operators */}
              <div className="mt-3.5 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lamina.cortes.map((corte, cIdx) => {
                  const isHovered = corte.id === hoveredCorteId;
                  const esReutilizado = corte.id !== lamina.cortes[0].id;
                  return (
                    <div
                      key={corte.id}
                      onMouseEnter={() => onHoverCorte(corte.id)}
                      onMouseLeave={() => onHoverCorte(null)}
                      onClick={() => {
                        setSelectedSegmentInfo({
                          title: `Corte de ${corte.largo.toFixed(2)}m`,
                          desc: `Este segmento de ${corte.largo.toFixed(2)}m está destinado al espacio "${corte.espacioNombre}" para ser instalado en la Hilera ${corte.hileraIndex + 1}. ${
                            esReutilizado 
                              ? 'Se obtiene cortando a partir del retal restante de esta lámina comercial, reduciendo el desperdicio del proyecto.'
                              : 'Es el primer corte principal realizado a partir de esta lámina nueva.'
                          }`
                        });
                      }}
                      className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition-all cursor-pointer duration-150 ${
                        isHovered
                          ? 'border-indigo-500/80 bg-indigo-950/40 ring-1 ring-indigo-500 scale-[1.03] shadow-md shadow-indigo-500/10'
                          : 'bg-slate-950/40 border-slate-800/40 hover:border-slate-700/50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${
                        isHovered ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {cIdx + 1}
                      </span>
                      <div>
                        <p className="text-slate-300 font-medium">Corte de {corte.largo.toFixed(2)}m</p>
                        <p className="text-[10px] text-slate-500">Destino: {corte.espacioNombre} (Hilera {corte.hileraIndex + 1})</p>
                      </div>
                    </div>
                  );
                })}
                
                {totalSobrante > 0.05 && (
                  <div 
                    onClick={() => {
                      setSelectedSegmentInfo({
                        title: `Retal Sobrante de ${totalSobrante.toFixed(2)}m`,
                        desc: `Este segmento es el material restante de la lámina después de realizar los cortes requeridos. No se utiliza para ningún corte en el proyecto actual. Al medir ${totalSobrante.toFixed(2)}m, se recomienda guardarlo en tu taller para futuras obras.`
                      });
                    }}
                    className="flex items-center gap-2 text-xs bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 hover:border-amber-500/30 cursor-pointer transition-all"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-[9px]">
                      R
                    </span>
                    <div>
                      <p className="text-amber-400 font-medium">Retal de {totalSobrante.toFixed(2)}m</p>
                      <p className="text-[10px] text-amber-500/80">Guardar sobrante utilizable</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED EXPLAINER MODAL FOR SEGMENT CLICKS */}
      {selectedSegmentInfo && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-slate-800 shadow-2xl relative space-y-4">
            <button
              onClick={() => setSelectedSegmentInfo(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/25">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">{selectedSegmentInfo.title}</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{selectedSegmentInfo.desc}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSegmentInfo(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED OFFSCREEN MULTI-ROOM REPORT CONTAINER FOR PDF GENERATION */}
      <div
        id="main-pdf-export-root"
        style={{ position: 'absolute', left: '-9999px', top: '0', width: '740px' }}
        className="bg-[#070b13] p-8 text-slate-100 space-y-8 Outfit"
      >
        {/* Document Header Page */}
        <div className="border-b border-slate-800 pb-5">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reporte Técnico de Optimización</h1>
              <p className="text-xs text-indigo-400 font-semibold uppercase mt-0.5">MaterialCalculator - PVC Ceiling Specialist</p>
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <p>Proyecto: <span className="text-slate-200 font-semibold">{nombreProyecto}</span></p>
              <p>Fecha: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Project statistics summary grid */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Láminas de Fábrica</span>
              <span className="text-lg font-bold text-slate-200 mt-1 block">{resultadoConsolidado.totalLaminas} piezas</span>
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Medida Comercial</span>
              <span className="text-lg font-bold text-slate-200 mt-1 block">{pvcConfig.largoComercial.toFixed(2)}m x {pvcConfig.anchoUtil.toFixed(2)}m</span>
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Desperdicio Total</span>
              <span className="text-lg font-bold text-amber-400 mt-1 block">{resultadoConsolidado.desperdicioGlobalPorcentaje}%</span>
            </div>
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <span className="block text-[10px] font-bold text-slate-500 uppercase">Presupuesto Estimado</span>
              <span className="text-lg font-bold text-emerald-400 mt-1 block">
                ${(resultadoConsolidado.totalLaminas * pvcConfig.precioPorLamina).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 1. PLANS FOR ALL ROOMS IN THE PROJECT */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-indigo-500/20 pb-1">
            Planos de Distribución y Cortes por Habitación
          </h2>
          
          <div className="grid grid-cols-2 gap-6">
            {espacios.map((espacio) => {
              const desglose = resultadoConsolidado.desgloseEspacios.find(d => d.espacioId === espacio.id);
              const orientacion = desglose?.orientacionElegida || 'largo';

              return (
                <div
                  key={espacio.id}
                  className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-4 flex flex-col items-center space-y-3"
                >
                  <div className="w-full flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200">{espacio.nombre}</span>
                    <span className="text-[10px] text-slate-400 capitalize">
                      Tendido: {orientacion === 'largo' ? 'Paralelo al Largo' : 'Paralelo al Ancho'}
                    </span>
                  </div>

                  {/* Draw canvas drawing for this room */}
                  <div className="flex justify-center w-full">
                    <RoomStaticCanvas
                      espacio={espacio}
                      config={pvcConfig}
                      resultadoConsolidado={resultadoConsolidado}
                    />
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-800/40 pt-2">
                    <div>
                      <span>Forma: </span>
                      <span className="text-slate-300 font-semibold capitalize">{espacio.tipo || 'rectangular'}</span>
                    </div>
                    <div>
                      <span>Área estimada: </span>
                      <span className="text-slate-300 font-semibold">{espacio.ancho}m x {espacio.largo}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. WORKSHOP CUTTING GUIDE FOR ALL SHEET BARS */}
        <div className="space-y-4 pt-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-indigo-500/20 pb-1">
            Guía Técnica de Cortes de Fábrica (Taller)
          </h2>

          <div className="space-y-4">
            {resultadoConsolidado.laminasComerciales.map((lamina, index) => {
              const totalUsado = lamina.cortes.reduce((acc, c) => acc + c.largo, 0);
              const totalSobrante = parseFloat((pvcConfig.largoComercial - totalUsado).toFixed(3));

              return (
                <div
                  key={lamina.id}
                  className="bg-slate-900/30 rounded-xl p-3.5 border border-slate-800/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-bold text-slate-200">Lámina de Fábrica #{index + 1} ({pvcConfig.largoComercial.toFixed(2)}m)</span>
                    <span>Usado: {totalUsado.toFixed(2)}m / Sobrante: {totalSobrante.toFixed(2)}m</span>
                  </div>

                  {/* Visual cut bar */}
                  <div className="h-7 w-full rounded bg-slate-950 border border-slate-800 flex overflow-hidden">
                    {lamina.cortes.map((corte) => {
                      const pct = (corte.largo / pvcConfig.largoComercial) * 100;
                      const espacioIdx = espacios.findIndex(e => e.id === corte.espacioId);
                      const colorClass = SEGMENT_COLORS[espacioIdx % SEGMENT_COLORS.length] || 'bg-indigo-600';

                      return (
                        <div
                          key={corte.id}
                          style={{ width: `${pct}%` }}
                          className={`h-full border-r border-slate-950/20 flex flex-col items-center justify-center text-[9px] font-bold px-0.5 ${colorClass}`}
                        >
                          <span className="truncate w-full text-center">{corte.largo}m</span>
                          <span className="text-[7px] opacity-75 truncate w-full text-center">{corte.espacioNombre}</span>
                        </div>
                      );
                    })}

                    {totalSobrante > 0 && (
                      <div
                        style={{ width: `${(totalSobrante / pvcConfig.largoComercial) * 100}%` }}
                        className={`h-full flex flex-col items-center justify-center text-[9px] font-semibold ${
                          totalSobrante > 0.05 ? 'bg-amber-600/30 text-amber-200' : 'bg-rose-950/30 text-rose-400/80'
                        }`}
                      >
                        <span>{totalSobrante}m</span>
                      </div>
                    )}
                  </div>

                  {/* Step list for this sheet */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/20">
                    {lamina.cortes.map((corte, cIdx) => (
                      <span key={corte.id}>
                        <strong className="text-slate-300 font-bold">{cIdx + 1}.</strong> {corte.largo.toFixed(2)}m ({corte.espacioNombre})
                      </span>
                    ))}
                    {totalSobrante > 0.05 && (
                      <span className="text-amber-400 font-medium">
                        <strong>R.</strong> Retal de {totalSobrante.toFixed(2)}m (Guardar)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
