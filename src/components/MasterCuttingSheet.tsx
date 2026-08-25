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

// High-fidelity OKLCH to RGB conversion helper
function oklchToRgb(oklchStr: string): string {
  const regex = /oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i;
  const match = oklchStr.match(regex);
  if (!match) return oklchStr;

  let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const C = parseFloat(match[2]);
  const H = parseFloat(match[3]) * (Math.PI / 180);
  const A = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  // OKLCH to OKLAB
  const a_val = C * Math.cos(H);
  const b_val = C * Math.sin(H);

  // OKLAB to LMS
  const l_lms = L + 0.3963377774 * a_val + 0.2158037573 * b_val;
  const m_lms = L - 0.1055613458 * a_val - 0.0638541728 * b_val;
  const s_lms = L - 0.0894841775 * a_val - 1.2914855480 * b_val;

  // LMS to linear RGB
  const l3 = l_lms * l_lms * l_lms;
  const m3 = m_lms * m_lms * m_lms;
  const s3 = s_lms * s_lms * s_lms;

  let r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_lin = -0.0041960863 * l3 - 0.7034186145 * m3 + 1.7076147010 * s3;

  // sRGB gamma correction
  const gamma = (c: number) => {
    const abs = Math.abs(c);
    const corrected = abs <= 0.0031308 ? 12.92 * abs : 1.055 * Math.pow(abs, 1 / 2.4) - 0.055;
    return c < 0 ? -corrected : corrected;
  };

  const r = Math.max(0, Math.min(255, Math.round(gamma(r_lin) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(gamma(g_lin) * 255)));
  const b = Math.max(0, Math.min(255, Math.round(gamma(b_lin) * 255)));

  return A === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${A})`;
}

// High-fidelity OKLAB to RGB conversion helper
function oklabToRgb(oklabStr: string): string {
  const regex = /oklab\(\s*([0-9.]+%?)\s+([+-]?[0-9.]+)\s+([+-]?[0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)/i;
  const match = oklabStr.match(regex);
  if (!match) return oklabStr;

  let L = match[1].endsWith('%') ? parseFloat(match[1]) / 100 : parseFloat(match[1]);
  const a_val = parseFloat(match[2]);
  const b_val = parseFloat(match[3]);
  const A = match[4] ? (match[4].endsWith('%') ? parseFloat(match[4]) / 100 : parseFloat(match[4])) : 1;

  // OKLAB to LMS
  const l_lms = L + 0.3963377774 * a_val + 0.2158037573 * b_val;
  const m_lms = L - 0.1055613458 * a_val - 0.0638541728 * b_val;
  const s_lms = L - 0.0894841775 * a_val - 1.2914855480 * b_val;

  // LMS to linear RGB
  const l3 = l_lms * l_lms * l_lms;
  const m3 = m_lms * m_lms * m_lms;
  const s3 = s_lms * s_lms * s_lms;

  let r_lin = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g_lin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let b_lin = -0.0041960863 * l3 - 0.7034186145 * m3 + 1.7076147010 * s3;

  const gamma = (c: number) => {
    const abs = Math.abs(c);
    const corrected = abs <= 0.0031308 ? 12.92 * abs : 1.055 * Math.pow(abs, 1 / 2.4) - 0.055;
    return c < 0 ? -corrected : corrected;
  };

  const r = Math.max(0, Math.min(255, Math.round(gamma(r_lin) * 255)));
  const g = Math.max(0, Math.min(255, Math.round(gamma(g_lin) * 255)));
  const b = Math.max(0, Math.min(255, Math.round(gamma(b_lin) * 255)));

  return A === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${A})`;
}

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

      const esInicioDeLamina = corte.isFirstInLamina;
      let fillStyle = 'rgba(99, 102, 241, 0.45)';
      let strokeStyle = 'rgba(129, 140, 248, 0.8)';
      
      if (!esInicioDeLamina) {
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

  // Group commercial sheets in chunks of 4 to fit perfectly on A4 pages without split cuts
  const laminasChunkSize = 4;
  const laminasChunks: any[][] = [];
  for (let i = 0; i < resultadoConsolidado.laminasComerciales.length; i += laminasChunkSize) {
    laminasChunks.push(resultadoConsolidado.laminasComerciales.slice(i, i + laminasChunkSize));
  }

  // Group 3D room images in chunks of 2 to fit perfectly on A4 pages
  const espaciosCon3D = espacios.filter(e => e.threeDDataURL);
  const chunks3D: any[][] = [];
  for (let i = 0; i < espaciosCon3D.length; i += 2) {
    chunks3D.push(espaciosCon3D.slice(i, i + 2));
  }

  const exportarReportePDF = async () => {
    setGenerandoPDF(true);
    
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (el, pseudoElt) {
      const style = originalGetComputedStyle.call(this || window, el, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const val = Reflect.get(target, prop);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
            return val.replace(/oklch\([^)]*\)/gi, (m) => oklchToRgb(m))
                      .replace(/oklab\([^)]*\)/gi, (m) => oklabToRgb(m));
          }
          return val;
        }
      });
    };

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const rootElement = document.getElementById('main-pdf-export-root');
      if (!rootElement) {
        alert('Error: No se pudo localizar el contenedor del reporte.');
        window.getComputedStyle = originalGetComputedStyle;
        setGenerandoPDF(false);
        return;
      }

      const pages = rootElement.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        alert('Error: No se localizaron páginas en el reporte.');
        window.getComputedStyle = originalGetComputedStyle;
        setGenerandoPDF(false);
        return;
      }

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageEl, {
          scale: 2.2,
          useCORS: true,
          backgroundColor: '#070b13',
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll('style').forEach((styleEl) => {
              let cssText = styleEl.textContent || '';
              cssText = cssText.replace(/oklch\([^)]*\)/gi, (m) => oklchToRgb(m));
              cssText = cssText.replace(/oklab\([^)]*\)/gi, (m) => oklabToRgb(m));
              styleEl.textContent = cssText;
            });
          }
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        const imgWidth = doc.internal.pageSize.getWidth();
        const imgHeight = doc.internal.pageSize.getHeight();

        if (i > 0) {
          doc.addPage();
        }
        doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
      }

      const safeName = nombreProyecto.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`reporte_${safeName}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al generar el PDF.');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
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
      {/* Width: 794px. Each child ".pdf-page" has width: 794px and height: 1122px (Standard A4 at 96 DPI) */}
      <div
        id="main-pdf-export-root"
        style={{ position: 'absolute', left: '-9999px', top: '0', width: '794px' }}
        className="text-slate-100 Outfit"
      >
        {/* PAGE 1: HEADER, OVERVIEW AND 2D PLANS */}
        <div 
          className="pdf-page bg-[#070b13] p-10 flex flex-col justify-between"
          style={{ width: '794px', height: '1122px', boxSizing: 'border-box', overflow: 'hidden' }}
        >
          <div>
            {/* Header section */}
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
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Láminas de Fábrica</span>
                  <span className="text-base font-bold text-slate-200 mt-1 block">{resultadoConsolidado.totalLaminas} piezas</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Medida Comercial</span>
                  <span className="text-sm font-bold text-slate-200 mt-1 block">{pvcConfig.largoComercial.toFixed(2)}m x {pvcConfig.anchoUtil.toFixed(2)}m</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Desperdicio Total</span>
                  <span className="text-base font-bold text-amber-400 mt-1 block">{resultadoConsolidado.desperdicioGlobalPorcentaje}%</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Presupuesto Estimado</span>
                  <span className="text-base font-bold text-emerald-400 mt-1 block">
                    ${(resultadoConsolidado.totalLaminas * pvcConfig.precioPorLamina).toLocaleString('es-CO')}
                  </span>
                </div>
              </div>
            </div>

            {/* 1. PLANS FOR ALL ROOMS IN THE PROJECT */}
            <div className="space-y-4 mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400 border-b border-indigo-500/20 pb-1">
                Planos de Distribución y Cortes por Habitación
              </h2>
              
              <div className="grid grid-cols-2 gap-5">
                {espacios.slice(0, 4).map((espacio) => {
                  const desglose = resultadoConsolidado.desgloseEspacios.find(d => d.espacioId === espacio.id);
                  const orientacion = desglose?.orientacionElegida || 'largo';

                  return (
                    <div
                      key={espacio.id}
                      className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-3.5 flex flex-col items-center space-y-2.5"
                    >
                      <div className="w-full flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200 truncate max-w-[120px]">{espacio.nombre}</span>
                        <span className="text-[9px] text-slate-400 capitalize">
                          Tendido: {orientacion === 'largo' ? 'Largo' : 'Ancho'}
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

                      {/* Room plan color legend inside the PDF */}
                      <div className="flex gap-3 justify-center text-[7.5px] text-slate-400 pb-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-indigo-600 border border-indigo-400"></span>
                          <span>Lámina Nueva</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-emerald-600 border border-emerald-400"></span>
                          <span>Retal Reutilizado</span>
                        </div>
                      </div>

                      <div className="w-full grid grid-cols-2 gap-2 text-[9px] text-slate-500 border-t border-slate-800/45 pt-2">
                        <div>
                          <span>Forma: </span>
                          <span className="text-slate-350 capitalize">{espacio.tipo || 'rectangular'}</span>
                        </div>
                        <div>
                          <span>Área: </span>
                          <span className="text-slate-350">{espacio.ancho}m x {espacio.largo}m</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer page marker */}
          <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900 pt-3">
            <span>Generado con MaterialCalculator</span>
            <span>Página 1</span>
          </div>
        </div>

        {/* PAGE 2+: TECHNICAL CUTTING GUIDE FOR ALL SHEET BARS */}
        {laminasChunks.map((chunk, chunkIdx) => (
          <div
            key={chunkIdx}
            className="pdf-page bg-[#070b13] p-10 flex flex-col justify-between"
            style={{ width: '794px', height: '1122px', boxSizing: 'border-box', overflow: 'hidden' }}
          >
            <div>
              <div className="border-b border-slate-800 pb-3 mb-5 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Guía Técnica de Cortes de Fábrica (Taller) - Parte {chunkIdx + 1}
                </h2>
                <span className="text-[9px] text-slate-500">{nombreProyecto}</span>
              </div>

              <div className="space-y-4">
                {chunk.map((lamina, index) => {
                  const globalIdx = chunkIdx * laminasChunkSize + index;
                  const totalUsado = lamina.cortes.reduce((acc: number, c: any) => acc + c.largo, 0);
                  const totalSobrante = parseFloat((pvcConfig.largoComercial - totalUsado).toFixed(3));

                  return (
                    <div
                      key={lamina.id}
                      className="bg-slate-900/30 rounded-xl p-4 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-slate-200">Lámina de Fábrica #{globalIdx + 1} ({pvcConfig.largoComercial.toFixed(2)}m)</span>
                        <span>Usado: {totalUsado.toFixed(2)}m / Sobrante: {totalSobrante.toFixed(2)}m</span>
                      </div>

                      {/* Visual cut bar */}
                      <div className="h-11 w-full rounded bg-slate-950 border border-slate-800 flex overflow-hidden">
                        {lamina.cortes.map((corte: any, cIdx: number) => {
                          const pct = (corte.largo / pvcConfig.largoComercial) * 100;
                          const espacioIdx = espacios.findIndex(e => e.id === corte.espacioId);
                          const colorClass = SEGMENT_COLORS[espacioIdx % SEGMENT_COLORS.length] || 'bg-indigo-600';

                          return (
                            <div
                              key={corte.id}
                              style={{ 
                                width: `${pct}%`, 
                                display: 'block', 
                                textAlign: 'center', 
                                lineHeight: '44px', 
                                height: '44px',
                                boxSizing: 'border-box'
                              }}
                              className={`h-full border-r border-slate-950/20 text-xs font-black text-white ${colorClass}`}
                            >
                              {cIdx + 1}
                            </div>
                          );
                        })}

                        {totalSobrante > 0 && (
                          <div
                            style={{ 
                              width: `${(totalSobrante / pvcConfig.largoComercial) * 100}%`, 
                              display: 'block', 
                              textAlign: 'center', 
                              lineHeight: '44px', 
                              height: '44px',
                              boxSizing: 'border-box'
                            }}
                            className={`h-full text-xs font-black ${
                              totalSobrante > 0.05 ? 'bg-amber-600/30 text-amber-300' : 'bg-rose-950/30 text-rose-400'
                            }`}
                          >
                            {totalSobrante > 0.05 ? 'R' : 'D'}
                          </div>
                        )}
                      </div>

                      {/* Step list for this sheet */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] text-slate-400 pt-2 border-t border-slate-850/40">
                        {lamina.cortes.map((corte: any, cIdx: number) => (
                          <span key={corte.id}>
                            <strong className="text-slate-350 font-bold">{cIdx + 1}.</strong> {corte.largo.toFixed(2)}m ({corte.espacioNombre})
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

            <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900 pt-3">
              <span>Optimización de Cortes</span>
              <span>Página {chunkIdx + 2}</span>
            </div>
          </div>
        ))}

        {/* PAGE 3+: 3D MODEL PREVIEWS OF ALL ROOMS */}
        {chunks3D.map((chunk, idx3D) => (
          <div
            key={idx3D}
            className="pdf-page bg-[#070b13] p-10 flex flex-col justify-between"
            style={{ width: '794px', height: '1122px', boxSizing: 'border-box', overflow: 'hidden' }}
          >
            <div>
              <div className="border-b border-slate-800 pb-3 mb-6 flex justify-between items-center">
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Modelos 3D del Cielo Raso (Instalación) - Parte {idx3D + 1}
                </h2>
                <span className="text-[9px] text-slate-500">{nombreProyecto}</span>
              </div>

              <div className="space-y-6 flex flex-col items-center">
                {chunk.map((espacio: Espacio) => (
                  <div key={espacio.id} className="w-full flex flex-col items-center bg-slate-900/20 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                    <span className="text-xs font-bold text-slate-200">{espacio.nombre} (Vista 3D)</span>
                    <div className="w-full flex justify-center bg-slate-950/80 p-2 rounded-xl border border-slate-850">
                      <img 
                        src={espacio.threeDDataURL} 
                        className="w-[440px] h-[300px] object-contain rounded-lg shadow-xl" 
                        alt={`Vista 3D de ${espacio.nombre}`} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-500 border-t border-slate-900 pt-3">
              <span>Modelos 3D del Proyecto</span>
              <span>Página {laminasChunks.length + idx3D + 2}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
