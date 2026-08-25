import React, { useEffect, useState, useRef } from 'react';
import type { ProyectoGuardado, Espacio, PVCConfig, ResultadoConsolidado } from '../types/material';
import { projectStorageService } from '../services/projectStorageService';
import { pvcOptimizerEngine, obtenerVerticesDeEspacio } from '../helpers/pvcOptimizerEngine';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  X, 
  Calendar, 
  Trash2, 
  Edit3, 
  FileDown, 
  Layers, 
  FolderOpen,
  Loader
} from 'lucide-react';

interface ProjectHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (proyecto: ProyectoGuardado) => void;
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

// Helper Static Canvas component to draw plan for any space inside the PDF
const RoomStaticCanvasHistory: React.FC<{
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
    const cuts = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
      lamina.cortes
        .filter(c => c.espacioId === espacio.id)
        .map(c => ({
          ...c,
          isFirstInLamina: lamina.cortes[0].id === c.id
        }))
    );

    cuts.forEach((corte) => {
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

export const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
}) => {
  const [proyectos, setProyectos] = useState<ProyectoGuardado[]>([]);
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      cargarProyectos();
    }
  }, [isOpen]);

  const cargarProyectos = async () => {
    try {
      const lista = await projectStorageService.obtenerProyectos();
      setProyectos(lista);
    } catch (err) {
      console.error('Error al cargar proyectos:', err);
    }
  };

  const eliminarProyecto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este proyecto permanentemente?')) return;
    try {
      await projectStorageService.eliminarProyecto(id);
      await cargarProyectos();
    } catch (err) {
      console.error(err);
    }
  };

  const descargarPDFProyecto = async (proyecto: ProyectoGuardado, e: React.MouseEvent) => {
    e.stopPropagation();
    setExportingProjectId(proyecto.id);
    
    // Temporarily override the main window's getComputedStyle during html2canvas runtime.
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

    // Allow time for the offscreen rendering area to mount and draw canvases
    setTimeout(async () => {
      try {
        const rootElement = document.getElementById(`history-pdf-export-root-${proyecto.id}`);
        if (!rootElement) {
          alert('Error: No se pudo localizar el contenedor de exportación.');
          window.getComputedStyle = originalGetComputedStyle;
          setExportingProjectId(null);
          return;
        }

        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: 'a4',
        });

        const pages = rootElement.querySelectorAll('.pdf-page');
        if (pages.length === 0) {
          alert('Error: No se localizaron páginas en el reporte.');
          window.getComputedStyle = originalGetComputedStyle;
          setExportingProjectId(null);
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

          const imgData = canvas.toDataURL('image/png');
          const imgWidth = doc.internal.pageSize.getWidth();
          const imgHeight = doc.internal.pageSize.getHeight();

          if (i > 0) {
            doc.addPage();
          }
          doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        }

        const safeName = proyecto.nombreProyecto.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        doc.save(`reporte_${safeName}.pdf`);
      } catch (err) {
        console.error(err);
        alert('Ocurrió un error al generar el PDF.');
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
        setExportingProjectId(null);
      }
    }, 350);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Historial de Proyectos</h2>
              <p className="text-xs text-slate-400">Administra, carga y exporta reportes de tus proyectos guardados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Project List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {proyectos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-4 bg-slate-900 rounded-full border border-slate-800 text-slate-600">
                <FolderOpen className="w-10 h-10" />
              </div>
              <p className="text-slate-400 text-sm font-medium">No tienes proyectos guardados aún.</p>
              <p className="text-[11px] text-slate-500 max-w-xs">Comienza por definir habitaciones, consolidar tu proyecto y hacer click en "Guardar Proyecto".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proyectos.map((proyecto) => {
                 const opt = pvcOptimizerEngine.optimizarCortes(proyecto.espacios, proyecto.pvcConfig);
                 const costoTotal = opt.totalLaminas * proyecto.pvcConfig.precioPorLamina;
                 const isExportingThis = exportingProjectId === proyecto.id;

                 // Group commercial sheets in chunks of 4 to fit perfectly on A4 pages without split cuts
                 const laminasChunkSize = 4;
                 const laminasChunks: any[][] = [];
                 for (let i = 0; i < opt.laminasComerciales.length; i += laminasChunkSize) {
                   laminasChunks.push(opt.laminasComerciales.slice(i, i + laminasChunkSize));
                 }

                 // Group 3D room images in chunks of 2 to fit perfectly on A4 pages
                 const espaciosCon3D = proyecto.espacios.filter(e => e.threeDDataURL);
                 const chunks3D: any[][] = [];
                 for (let i = 0; i < espaciosCon3D.length; i += 2) {
                   chunks3D.push(espaciosCon3D.slice(i, i + 2));
                 }

                 return (
                   <div
                     key={proyecto.id}
                     className="bg-slate-900/25 border border-slate-850 hover:border-slate-700/60 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:shadow-xl transition-all duration-200"
                   >
                     <div>
                       <div className="flex justify-between items-start">
                         <h3 className="font-bold text-slate-200 text-sm truncate max-w-[200px]" title={proyecto.nombreProyecto}>
                           {proyecto.nombreProyecto}
                         </h3>
                         <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-semibold uppercase">
                           Proyecto PVC
                         </span>
                       </div>

                      <div className="flex items-center gap-4 text-[10px] text-slate-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(proyecto.fecha).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5" />
                          {proyecto.espacios.length} {proyecto.espacios.length === 1 ? 'Habitación' : 'Habitaciones'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-950/45 p-3 rounded-xl border border-slate-900/60 text-center">
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-semibold">Láminas</span>
                          <span className="text-xs font-bold text-slate-350">{opt.totalLaminas} uds</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-semibold">Desperdicio</span>
                          <span className="text-xs font-bold text-amber-500">{opt.desperdicioGlobalPorcentaje}%</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 uppercase block font-semibold">Costo</span>
                          <span className="text-xs font-bold text-emerald-400">${costoTotal.toLocaleString('es-CO')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => onSelectProject(proyecto)}
                        className="flex items-center justify-center gap-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 cursor-pointer transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Cargar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => descargarPDFProyecto(proyecto, e)}
                        disabled={isExportingThis}
                        className="flex items-center justify-center gap-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/50 cursor-pointer transition-all disabled:cursor-not-allowed"
                        title="Descargar PDF"
                      >
                        {isExportingThis ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={(e) => eliminarProyecto(proyecto.id, e)}
                        className="flex items-center justify-center gap-1 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-750 hover:border-rose-900/60 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    </div>

                    {/* DEDICATED OFFSCREEN MULTI-ROOM REPORT CONTAINER FOR HISTORY PDF GENERATION */}
                    {isExportingThis && (
                      <div
                        id={`history-pdf-export-root-${proyecto.id}`}
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
                                  <p>Proyecto: <span className="text-slate-200 font-semibold">{proyecto.nombreProyecto}</span></p>
                                  <p>Fecha: {new Date(proyecto.fecha).toLocaleDateString()}</p>
                                </div>
                              </div>

                              {/* Project statistics summary grid */}
                              <div className="grid grid-cols-4 gap-4 mt-6">
                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Láminas de Fábrica</span>
                                  <span className="text-base font-bold text-slate-200 mt-1 block">{opt.totalLaminas} piezas</span>
                                </div>
                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Medida Comercial</span>
                                  <span className="text-sm font-bold text-slate-200 mt-1 block">{proyecto.pvcConfig.largoComercial.toFixed(2)}m x {proyecto.pvcConfig.anchoUtil.toFixed(2)}m</span>
                                </div>
                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Desperdicio Total</span>
                                  <span className="text-base font-bold text-amber-400 mt-1 block">{opt.desperdicioGlobalPorcentaje}%</span>
                                </div>
                                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Presupuesto Estimado</span>
                                  <span className="text-base font-bold text-emerald-400 mt-1 block">
                                    ${costoTotal.toLocaleString('es-CO')}
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
                                {proyecto.espacios.slice(0, 4).map((espacio) => {
                                  const desglose = opt.desgloseEspacios.find((d: any) => d.espacioId === espacio.id);
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
                                        <RoomStaticCanvasHistory
                                          espacio={espacio}
                                          config={proyecto.pvcConfig}
                                          resultadoConsolidado={opt}
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

                                      <div className="w-full grid grid-cols-2 gap-2 text-[9px] text-slate-555 border-t border-slate-850 pt-2">
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
                                <span className="text-[9px] text-slate-500">{proyecto.nombreProyecto}</span>
                              </div>

                              <div className="space-y-4">
                                {chunk.map((lamina, index) => {
                                  const globalIdx = chunkIdx * laminasChunkSize + index;
                                  const totalUsado = lamina.cortes.reduce((acc: number, c: any) => acc + c.largo, 0);
                                  const totalSobrante = parseFloat((proyecto.pvcConfig.largoComercial - totalUsado).toFixed(3));

                                  return (
                                    <div
                                      key={lamina.id}
                                      className="bg-slate-900/30 rounded-xl p-4 border border-slate-800/80 space-y-3"
                                    >
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span className="font-bold text-slate-200">Lámina de Fábrica #{globalIdx + 1} ({proyecto.pvcConfig.largoComercial.toFixed(2)}m)</span>
                                        <span>Usado: {totalUsado.toFixed(2)}m / Sobrante: {totalSobrante.toFixed(2)}m</span>
                                      </div>

                                      {/* Visual cut bar */}
                                      <div className="h-11 w-full rounded bg-slate-950 border border-slate-800 flex overflow-hidden">
                                        {lamina.cortes.map((corte: any) => {
                                          const pct = (corte.largo / proyecto.pvcConfig.largoComercial) * 100;
                                          const espacioIdx = proyecto.espacios.findIndex(e => e.id === corte.espacioId);
                                          const colorClass = SEGMENT_COLORS[espacioIdx % SEGMENT_COLORS.length] || 'bg-indigo-600';

                                          return (
                                            <div
                                              key={corte.id}
                                              style={{ width: `${pct}%`, display: 'block', textAlign: 'center', paddingTop: '6px', boxSizing: 'border-box' }}
                                              className={`h-full border-r border-slate-950/20 text-[10px] font-bold px-0.5 ${colorClass}`}
                                            >
                                              <div style={{ display: 'block', lineHeight: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {corte.largo.toFixed(2)}m
                                              </div>
                                              <div style={{ display: 'block', fontSize: '7.5px', lineHeight: '10px', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                                                {corte.espacioNombre}
                                              </div>
                                            </div>
                                          );
                                        })}

                                        {totalSobrante > 0 && (
                                          <div
                                            style={{ width: `${(totalSobrante / proyecto.pvcConfig.largoComercial) * 100}%`, display: 'block', textAlign: 'center', paddingTop: '6px', boxSizing: 'border-box' }}
                                            className={`h-full text-[10px] font-semibold ${
                                              totalSobrante > 0.05 ? 'bg-amber-600/30 text-amber-255' : 'bg-rose-950/30 text-rose-455/80'
                                            }`}
                                          >
                                            <div style={{ display: 'block', lineHeight: '13px' }}>
                                              {totalSobrante.toFixed(2)}m
                                            </div>
                                            <div style={{ display: 'block', fontSize: '7.5px', lineHeight: '10px', opacity: 0.8, marginTop: '1px' }}>
                                              {totalSobrante > 0.05 ? 'Retal' : 'Desp.'}
                                            </div>
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
                                <span className="text-[9px] text-slate-500">{proyecto.nombreProyecto}</span>
                              </div>

                              <div className="space-y-6 flex flex-col items-center">
                                {chunk.map((espacio: Espacio) => (
                                  <div key={espacio.id} className="w-full flex flex-col items-center bg-slate-900/20 border border-slate-800/80 rounded-2xl p-4 space-y-2">
                                    <span className="text-xs font-bold text-slate-205">{espacio.nombre} (Vista 3D)</span>
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
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
