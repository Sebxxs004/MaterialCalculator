import React, { useEffect, useState } from 'react';
import type { ProyectoGuardado } from '../types/material';
import { projectStorageService } from '../services/projectStorageService';
import { pvcOptimizerEngine } from '../helpers/pvcOptimizerEngine';
import { jsPDF } from 'jspdf';
import { 
  X, 
  User, 
  Calendar, 
  Trash2, 
  Edit3, 
  FileDown, 
  Layers, 
  FolderOpen
} from 'lucide-react';

interface ProjectHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (proyecto: ProyectoGuardado) => void;
}

export const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
}) => {
  const [proyectos, setProyectos] = useState<ProyectoGuardado[]>([]);

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
    try {
      // Calculate consolidated optimization results for the saved project
      const opt = pvcOptimizerEngine.optimizarCortes(proyecto.espacios, proyecto.pvcConfig);
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });


      // Header Block
      doc.setFillColor(15, 23, 42); // slate 900
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('MaterialCalculator - Reporte de Obra', 24, 40);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184); // slate 400
      doc.text('Optimizador de Cielo Raso en PVC', 24, 55);

      // Metadatos
      doc.setTextColor(15, 23, 42);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Detalles del Proyecto', 24, 110);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Nombre Proyecto: ${proyecto.nombreProyecto}`, 24, 130);
      doc.text(`Cliente: ${proyecto.cliente || 'Consumidor Final'}`, 24, 145);
      doc.text(`Fecha: ${new Date(proyecto.fecha).toLocaleDateString()}`, 24, 160);

      // PVC Config Details
      doc.setFont('Helvetica', 'bold');
      doc.text('Especificación PVC:', 250, 110);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Largo Comercial: ${proyecto.pvcConfig.largoComercial}m`, 250, 130);
      doc.text(`Ancho Útil: ${proyecto.pvcConfig.anchoUtil}m`, 250, 145);
      doc.text(`Precio por Lámina: $${proyecto.pvcConfig.precioPorLamina.toLocaleString('es-CO')}`, 250, 160);

      // Line separator
      doc.setDrawColor(226, 232, 240);
      doc.line(24, 180, doc.internal.pageSize.getWidth() - 24, 180);

      // Room Designs and Snapshot Preview
      if (proyecto.canvasDataURL) {
        doc.setFont('Helvetica', 'bold');
        doc.text('Plano de Distribución Activo:', 24, 205);
        try {
          doc.addImage(proyecto.canvasDataURL, 'PNG', 24, 220, 180, 180);
        } catch {
          doc.text('[Error al renderizar plano]', 24, 230);
        }
      }

      // Summary Stats
      const statsY = 220;
      doc.setFont('Helvetica', 'bold');
      doc.text('Resumen de Optimización:', 230, 205);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Total Habitaciones: ${proyecto.espacios.length}`, 230, statsY);
      doc.text(`Láminas a Comprar (5.95m): ${opt.totalLaminas} unidades`, 230, statsY + 18);
      doc.text(`Porcentaje de Desperdicio: ${opt.desperdicioGlobalPorcentaje}%`, 230, statsY + 36);
      
      const costoTotal = opt.totalLaminas * proyecto.pvcConfig.precioPorLamina;
      doc.setFont('Helvetica', 'bold');
      doc.text(`Costo Total Estimado: $${costoTotal.toLocaleString('es-CO')}`, 230, statsY + 60);

      // Table of Spaces
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Habitaciones / Espacios Calculados:', 24, 425);
      
      let rowY = 445;
      doc.setFontSize(9);
      doc.setFillColor(241, 245, 249);
      doc.rect(24, rowY - 10, doc.internal.pageSize.getWidth() - 48, 16, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFont('Helvetica', 'bold');
      doc.text('Espacio', 30, rowY);
      doc.text('Medidas (Ancho x Largo)', 160, rowY);
      doc.text('Orientación', 300, rowY);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      
      proyecto.espacios.forEach((esp) => {
        rowY += 18;
        doc.text(esp.nombre, 30, rowY);
        doc.text(`${esp.ancho.toFixed(2)}m x ${esp.largo.toFixed(2)}m`, 160, rowY);
        doc.text(esp.orientacionSeleccionada === 'auto' ? 'Automática' : esp.orientacionSeleccionada === 'largo' ? 'Largo' : 'Ancho', 300, rowY);
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('MaterialCalculator - Generado automáticamente.', 24, doc.internal.pageSize.getHeight() - 20);

      const safeName = proyecto.nombreProyecto.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`reporte_${safeName}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF de historial.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300">
      <div className="glass-panel w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Administrador de Proyectos</h2>
              <p className="text-xs text-slate-400">Inspecciona, descarga reportes y edita proyectos guardados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/20">
          {proyectos.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/10">
              <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-slate-300">No hay proyectos almacenados</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Todos los proyectos que guardes se guardarán localmente en la base de datos de tu navegador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {proyectos.map((proyecto) => {
                const opt = pvcOptimizerEngine.optimizarCortes(proyecto.espacios, proyecto.pvcConfig);

                return (
                  <div
                    key={proyecto.id}
                    className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700/60 hover:bg-slate-900/60 transition-all duration-300 group"
                  >
                    <div>
                      {/* Base64 canvas render snapshot */}
                      <div className="w-full h-36 bg-slate-950 rounded-xl overflow-hidden mb-4 border border-slate-800 flex items-center justify-center relative">
                        {proyecto.canvasDataURL ? (
                          <img
                            src={proyecto.canvasDataURL}
                            alt={proyecto.nombreProyecto}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 to-slate-900 flex flex-col items-center justify-center text-slate-500">
                            <Layers className="w-6 h-6 text-indigo-500/30 mb-1" />
                            <span className="text-[10px] tracking-widest uppercase">Sin Imagen</span>
                          </div>
                        )}
                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-slate-950/80 backdrop-blur-sm rounded text-[9px] text-slate-400 border border-slate-800/50">
                          {proyecto.espacios.length} {proyecto.espacios.length === 1 ? 'hab' : 'habs'}
                        </span>
                      </div>

                      {/* Info header */}
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-slate-200 truncate">
                          {proyecto.nombreProyecto}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{proyecto.cliente || 'Consumidor Final'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(proyecto.fecha).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Summary Metrics */}
                      <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-slate-950/20 p-2.5 rounded-xl">
                        <div className="space-y-0.5">
                          <span className="text-slate-500 block">Láminas (5.95m):</span>
                          <span className="font-bold text-indigo-400 text-xs">{opt.totalLaminas} uds</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 block">Desperdicio:</span>
                          <span className={`font-bold text-xs ${
                            opt.desperdicioGlobalPorcentaje > 15 ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {opt.desperdicioGlobalPorcentaje}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-800/60 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProject(proyecto)}
                        className="flex items-center justify-center gap-1 py-2 px-2.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Cargar en la pantalla de edición"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => descargarPDFProyecto(proyecto, e)}
                        className="flex items-center justify-center gap-1 py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-slate-700/40"
                        title="Descargar reporte PDF del proyecto"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={(e) => eliminarProyecto(proyecto.id, e)}
                        className="flex items-center justify-center gap-1 py-2 px-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        title="Eliminar de IndexedDB"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Borrar
                      </button>
                    </div>
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
