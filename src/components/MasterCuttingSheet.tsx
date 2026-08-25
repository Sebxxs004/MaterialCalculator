import React, { useState } from 'react';
import type { Espacio, PVCConfig, ResultadoConsolidado } from '../types/material';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown, Scissors, Loader } from 'lucide-react';

interface MasterCuttingSheetProps {
  resultadoConsolidado: ResultadoConsolidado;
  espacios: Espacio[];
  pvcConfig: PVCConfig;
  nombreProyecto: string;
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

export const MasterCuttingSheet: React.FC<MasterCuttingSheetProps> = ({
  resultadoConsolidado,
  espacios,
  pvcConfig,
  nombreProyecto,
}) => {
  const [generandoPDF, setGenerandoPDF] = useState(false);

  const exportarReportePDF = async () => {
    setGenerandoPDF(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const rootElement = document.getElementById('main-content-to-export');
      if (!rootElement) {
        alert('Error: No se pudo localizar el contenedor del reporte.');
        setGenerandoPDF(false);
        return;
      }

      // Hide export buttons momentarily
      const buttons = document.querySelectorAll('.no-export-pdf');
      buttons.forEach(b => b.classList.add('hidden'));

      const canvas = await html2canvas(rootElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#070b13', // Keep dark slate backdrop style
      });

      // Show export buttons again
      buttons.forEach(b => b.classList.remove('hidden'));

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

      {/* Sheet details listing */}
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

                  return (
                    <div
                      key={corte.id}
                      style={{ width: `${pct}%` }}
                      className={`h-full border-r border-slate-950/20 flex flex-col items-center justify-center text-[10px] font-bold px-1 transition-all hover:brightness-105 select-none ${colorClass}`}
                    >
                      <span className="truncate w-full text-center">{corte.largo}m</span>
                      <span className="text-[7.5px] opacity-75 truncate w-full text-center">{corte.espacioNombre}</span>
                    </div>
                  );
                })}

                {totalSobrante > 0 && (
                  <div
                    style={{ width: `${(totalSobrante / pvcConfig.largoComercial) * 100}%` }}
                    className={`h-full flex flex-col items-center justify-center text-[10px] font-semibold select-none ${
                      totalSobrante > 0.05 
                        ? 'bg-amber-600/35 text-amber-200 border-l border-amber-500/20' 
                        : 'bg-rose-950/30 text-rose-400/80'
                    }`}
                  >
                    <span>{totalSobrante}m</span>
                    <span className="text-[7.5px] opacity-75">
                      {totalSobrante > 0.05 ? 'Retal Reutilizable' : 'Desperdicio'}
                    </span>
                  </div>
                )}
              </div>

              {/* Cut checklist instructions for operators */}
              <div className="mt-3.5 pt-3 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lamina.cortes.map((corte, cIdx) => (
                  <div
                    key={corte.id}
                    className="flex items-center gap-2 text-xs bg-slate-950/40 p-2 rounded-lg border border-slate-800/40"
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">
                      {cIdx + 1}
                    </span>
                    <div>
                      <p className="text-slate-300 font-medium">Corte de {corte.largo.toFixed(2)}m</p>
                      <p className="text-[10px] text-slate-500">Destino: {corte.espacioNombre} (Hilera {corte.hileraIndex + 1})</p>
                    </div>
                  </div>
                ))}
                
                {totalSobrante > 0.05 && (
                  <div className="flex items-center gap-2 text-xs bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
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
    </div>
  );
};
