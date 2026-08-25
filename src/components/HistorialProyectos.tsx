import React from 'react';
import type { ProyectoGuardado } from '../types/material';
import { FolderOpen, Calendar, User, Trash2, ArrowRight, Layers } from 'lucide-react';

interface HistorialProyectosProps {
  proyectos: ProyectoGuardado[];
  onSeleccionar: (proyecto: ProyectoGuardado) => void;
  onEliminar: (id: string) => void;
  proyectoActivoId?: string;
}

export const HistorialProyectos: React.FC<HistorialProyectosProps> = ({
  proyectos,
  onSeleccionar,
  onEliminar,
  proyectoActivoId,
}) => {
  const formatearFecha = (fechaStr: string) => {
    try {
      const fecha = new Date(fechaStr);
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(fecha);
    } catch {
      return fechaStr;
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
          <FolderOpen className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Proyectos Guardados</h2>
          <p className="text-xs text-slate-400">Historial de optimizaciones en IndexedDB</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {proyectos.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
            <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">No hay proyectos guardados</p>
            <p className="text-xs text-slate-500 mt-1">
              Guarda tu proyecto actual para verlo en esta lista.
            </p>
          </div>
        ) : (
          proyectos.map((proyecto) => {
            const esActivo = proyecto.id === proyectoActivoId;
            return (
              <div
                key={proyecto.id}
                className={`group relative rounded-xl p-3.5 border transition-all duration-300 flex gap-4 cursor-pointer select-none ${
                  esActivo
                    ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md shadow-indigo-500/5'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                }`}
                onClick={() => onSeleccionar(proyecto)}
              >
                {/* Miniatura del Canvas o Placeholder */}
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800 relative flex items-center justify-center">
                  {proyecto.canvasDataURL ? (
                    <img
                      src={proyecto.canvasDataURL}
                      alt={proyecto.nombreProyecto}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-slate-900 flex flex-col items-center justify-center text-slate-500">
                      <Layers className="w-5 h-5 text-indigo-400/40 mb-1" />
                      <span className="text-[9px] uppercase tracking-wider">Sin Vista</span>
                    </div>
                  )}
                </div>

                {/* Información */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <h3 className={`text-sm font-semibold truncate ${esActivo ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {proyecto.nombreProyecto}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                      <User className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                      <span className="truncate">{proyecto.cliente || 'Consumidor Final'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatearFecha(proyecto.fecha)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-slate-800/60 rounded text-slate-400 border border-slate-700/40">
                      {proyecto.espacios.length} {proyecto.espacios.length === 1 ? 'Espacio' : 'Espacios'}
                    </span>
                  </div>
                </div>

                {/* Acciones flotantes */}
                <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEliminar(proyecto.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-1.5 text-indigo-400 rounded-lg bg-indigo-500/10">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
