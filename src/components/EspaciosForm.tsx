import React from 'react';
import type { Espacio, Orientacion } from '../types/material';
import { Home, Trash2, Plus, ArrowUpDown, Compass } from 'lucide-react';

interface EspaciosFormProps {
  espacios: Espacio[];
  onChange: (nuevosEspacios: Espacio[]) => void;
}

export const EspaciosForm: React.FC<EspaciosFormProps> = ({ espacios, onChange }) => {
  const agregarEspacio = () => {
    const nuevoEspacio: Espacio = {
      id: crypto.randomUUID(),
      nombre: `Espacio ${espacios.length + 1}`,
      largo: 4.0,
      ancho: 3.0,
      orientacionSeleccionada: 'auto',
    };
    onChange([...espacios, nuevoEspacio]);
  };

  const eliminarEspacio = (id: string) => {
    onChange(espacios.filter((e) => e.id !== id));
  };

  const actualizarEspacio = (id: string, campo: keyof Espacio, valor: any) => {
    onChange(
      espacios.map((e) => {
        if (e.id === id) {
          if (campo === 'largo' || campo === 'ancho') {
            const num = parseFloat(valor);
            return { ...e, [campo]: isNaN(num) ? 0 : num };
          }
          return { ...e, [campo]: valor };
        }
        return e;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-500/10 text-violet-400 rounded-xl border border-violet-500/20">
            <Home className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Espacios / Habitaciones</h2>
            <p className="text-xs text-slate-400">Agrega y configura los ambientes a techar</p>
          </div>
        </div>

        <button
          type="button"
          onClick={agregarEspacio}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Agregar Espacio
        </button>
      </div>

      {espacios.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-slate-700/60">
          <div className="inline-flex p-4 bg-slate-800/40 text-slate-500 rounded-full mb-4">
            <Home className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-300">No hay espacios agregados</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Comienza agregando un espacio para calcular la cantidad de láminas de PVC requeridas.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          {espacios.map((espacio, index) => (
            <div
              key={espacio.id}
              className="glass-panel rounded-2xl p-5 shadow-lg relative group transition-all duration-300 border border-slate-700/50 hover:border-slate-600/70 hover:shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-400 rounded-lg">
                  Espacio #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => eliminarEspacio(espacio.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-200 cursor-pointer"
                  title="Eliminar espacio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nombre del Espacio
                  </label>
                  <input
                    type="text"
                    value={espacio.nombre}
                    onChange={(e) => actualizarEspacio(espacio.id, 'nombre', e.target.value)}
                    className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:ring-indigo-500 text-sm border focus:outline-none"
                    placeholder="Ej. Sala Principal"
                  />
                </div>

                {/* Dimensiones */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 rotate-90" />
                      Ancho (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={espacio.ancho || ''}
                      onChange={(e) => actualizarEspacio(espacio.id, 'ancho', e.target.value)}
                      className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                      Largo (m)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={espacio.largo || ''}
                      onChange={(e) => actualizarEspacio(espacio.id, 'largo', e.target.value)}
                      className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Orientación */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-400" />
                    Orientación de Instalación
                  </label>
                  <select
                    value={espacio.orientacionSeleccionada}
                    onChange={(e) =>
                      actualizarEspacio(espacio.id, 'orientacionSeleccionada', e.target.value as Orientacion)
                    }
                    className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3 py-2.5 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="auto">Automático (Optimizar Desperdicio)</option>
                    <option value="largo">A lo Largo (Paralelo a la longitud)</option>
                    <option value="ancho">A lo Ancho (Paralelo a la latitud)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
