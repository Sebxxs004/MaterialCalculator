import React from 'react';
import type { Espacio, Orientacion, TipoEspacio } from '../types/material';
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
      tipo: 'rectangular',
      vertices: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
        { x: 0, y: 4 }
      ]
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
          // If we change room type, initialize vertices defaults
          if (campo === 'tipo') {
            const tipo = valor as TipoEspacio;
            let vertices = e.vertices;
            if (tipo === 'rectangular') {
              vertices = [
                { x: 0, y: 0 },
                { x: e.ancho, y: 0 },
                { x: e.ancho, y: e.largo },
                { x: 0, y: e.largo }
              ];
              return { ...e, tipo, vertices };
            } else if (tipo === 'l_shape') {
              const la = e.largo * 0.6;
              const wa = e.ancho * 0.6;
              vertices = [
                { x: 0, y: 0 },
                { x: e.ancho, y: 0 },
                { x: e.ancho, y: la },
                { x: wa, y: la },
                { x: wa, y: e.largo },
                { x: 0, y: e.largo }
              ];
              return { 
                ...e, 
                tipo, 
                vertices,
                largoA: e.largo * 0.6,
                anchoA: e.ancho * 0.6
              };
            } else if (tipo === 'polygon') {
              vertices = [
                { x: 0, y: 0 },
                { x: e.ancho, y: 0 },
                { x: e.ancho, y: e.largo },
                { x: e.ancho * 0.5, y: e.largo + 1 },
                { x: 0, y: e.largo }
              ];
              return { ...e, tipo, vertices };
            } else if (tipo === 'mocheta') {
              vertices = [
                { x: 0, y: 0 },
                { x: 2.50, y: 0 },
                { x: 2.50, y: 2.20 },
                { x: 1.70, y: 2.20 },
                { x: 1.70, y: 2.60 },
                { x: 0, y: 2.60 }
              ];
              return {
                ...e,
                tipo,
                vertices,
                anchoSup: 2.50,
                largoIzq: 2.60,
                anchoInf: 1.70,
                profQuiebre: 0.40,
                posQuiebre: 'inf_der',
                ancho: 2.50,
                largo: 2.60
              };
            }
          }

          // rectangular & L-shape inputs handler
          if (campo === 'largo' || campo === 'ancho' || campo === 'largoA' || campo === 'anchoA') {
            const num = parseFloat(valor);
            const val = isNaN(num) ? 0 : num;
            
            const updated = { ...e, [campo]: val };
            const tipo = e.tipo || 'rectangular';
            if (tipo === 'rectangular') {
              updated.vertices = [
                { x: 0, y: 0 },
                { x: updated.ancho, y: 0 },
                { x: updated.ancho, y: updated.largo },
                { x: 0, y: updated.largo }
              ];
            } else if (tipo === 'l_shape') {
              const l = updated.largo;
              const w = updated.ancho;
              const la = updated.largoA !== undefined ? updated.largoA : l * 0.6;
              const wa = updated.anchoA !== undefined ? updated.anchoA : w * 0.6;
              updated.vertices = [
                { x: 0, y: 0 },
                { x: w, y: 0 },
                { x: w, y: la },
                { x: wa, y: la },
                { x: wa, y: l },
                { x: 0, y: l }
              ];
            }
            return updated;
          }

          // Mocheta inputs handler
          if (campo === 'anchoSup' || campo === 'largoIzq' || campo === 'anchoInf' || campo === 'profQuiebre' || campo === 'posQuiebre') {
            const updated = { ...e, [campo]: valor };
            const wSup = updated.anchoSup !== undefined ? parseFloat(updated.anchoSup as any) : 2.50;
            const lIzq = updated.largoIzq !== undefined ? parseFloat(updated.largoIzq as any) : 2.60;
            const wInf = updated.anchoInf !== undefined ? parseFloat(updated.anchoInf as any) : 1.70;
            const dQ = updated.profQuiebre !== undefined ? parseFloat(updated.profQuiebre as any) : 0.40;
            const pos = updated.posQuiebre || 'inf_der';

            updated.ancho = Math.max(wSup, wInf);
            updated.largo = lIzq;

            if (pos === 'inf_der') {
              updated.vertices = [
                { x: 0, y: 0 },
                { x: wSup, y: 0 },
                { x: wSup, y: lIzq - dQ },
                { x: wInf, y: lIzq - dQ },
                { x: wInf, y: lIzq },
                { x: 0, y: lIzq }
              ];
            } else if (pos === 'inf_izq') {
              const cutoutW = wSup - wInf;
              updated.vertices = [
                { x: 0, y: 0 },
                { x: wSup, y: 0 },
                { x: wSup, y: lIzq },
                { x: cutoutW, y: lIzq },
                { x: cutoutW, y: lIzq - dQ },
                { x: 0, y: lIzq - dQ }
              ];
            } else if (pos === 'sup_der') {
              updated.vertices = [
                { x: 0, y: 0 },
                { x: wInf, y: 0 },
                { x: wInf, y: dQ },
                { x: wSup, y: dQ },
                { x: wSup, y: lIzq },
                { x: 0, y: lIzq }
              ];
            } else { // 'sup_izq'
              const cutoutW = wSup - wInf;
              updated.vertices = [
                { x: cutoutW, y: 0 },
                { x: wSup, y: 0 },
                { x: wSup, y: lIzq },
                { x: 0, y: lIzq },
                { x: 0, y: dQ },
                { x: cutoutW, y: dQ }
              ];
            }
            return updated;
          }

          return { ...e, [campo]: valor };
        }
        return e;
      })
    );
  };

  const handleVertexChange = (espacioId: string, vIdx: number, coord: 'x' | 'y', val: string) => {
    const num = parseFloat(val);
    const floatVal = isNaN(num) ? 0 : num;
    onChange(
      espacios.map((e) => {
        if (e.id === espacioId && e.vertices) {
          const updatedVertices = e.vertices.map((v, idx) => 
            idx === vIdx ? { ...v, [coord]: floatVal } : v
          );

          const xs = updatedVertices.map(v => v.x);
          const ys = updatedVertices.map(v => v.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          return { 
            ...e, 
            vertices: updatedVertices,
            ancho: parseFloat((maxX - minX).toFixed(2)),
            largo: parseFloat((maxY - minY).toFixed(2))
          };
        }
        return e;
      })
    );
  };

  const addVertex = (espacioId: string) => {
    onChange(
      espacios.map((e) => {
        if (e.id === espacioId && e.vertices) {
          const last = e.vertices[e.vertices.length - 1] || { x: 0, y: 0 };
          return {
            ...e,
            vertices: [...e.vertices, { x: last.x + 1, y: last.y }]
          };
        }
        return e;
      })
    );
  };

  const removeVertex = (espacioId: string, vIdx: number) => {
    onChange(
      espacios.map((e) => {
        if (e.id === espacioId && e.vertices && e.vertices.length > 3) {
          return {
            ...e,
            vertices: e.vertices.filter((_, idx) => idx !== vIdx)
          };
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
        <div className="grid gap-6 grid-cols-1">
          {espacios.map((espacio, index) => {
            const tipo = espacio.tipo || 'rectangular';

            return (
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
                  {/* Nombre y Tipo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Nombre del Espacio
                      </label>
                      <input
                        type="text"
                        value={espacio.nombre}
                        onChange={(e) => actualizarEspacio(espacio.id, 'nombre', e.target.value)}
                        className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500"
                        placeholder="Ej. Sala Principal"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Forma / Tipo de Habitación
                      </label>
                      <select
                        value={tipo}
                        onChange={(e) => actualizarEspacio(espacio.id, 'tipo', e.target.value)}
                        className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="rectangular">Rectangular estándar</option>
                        <option value="l_shape">Habitación en L (6 Lados)</option>
                        <option value="mocheta">Habitación con Mocheta / Quiebre en L</option>
                        <option value="polygon">Polígono libre / Angulado</option>
                      </select>
                    </div>
                  </div>

                  {/* Rectangular Dimensions */}
                  {tipo === 'rectangular' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400 rotate-90" />
                          Ancho Total (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.1"
                          value={espacio.ancho || ''}
                          onChange={(e) => actualizarEspacio(espacio.id, 'ancho', e.target.value)}
                          className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                          <ArrowUpDown className="w-3.5 h-3.5 text-indigo-400" />
                          Largo Total (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.1"
                          value={espacio.largo || ''}
                          onChange={(e) => actualizarEspacio(espacio.id, 'largo', e.target.value)}
                          className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3.5 py-2 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* L-Shape Dimensions */}
                  {tipo === 'l_shape' && (
                    <div className="space-y-3.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                      <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Dimensiones de la L:</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Ancho Total (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.ancho}
                            onChange={(e) => actualizarEspacio(espacio.id, 'ancho', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Largo Total (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.largo}
                            onChange={(e) => actualizarEspacio(espacio.id, 'largo', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Ancho Frente A (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.anchoA ?? ''}
                            onChange={(e) => actualizarEspacio(espacio.id, 'anchoA', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Largo Frente A (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.largoA ?? ''}
                            onChange={(e) => actualizarEspacio(espacio.id, 'largoA', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mocheta / Cutout preset inputs */}
                  {tipo === 'mocheta' && (
                    <div className="space-y-3.5 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                      <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Configuración del Quiebre / Mocheta:</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Ancho Total Superior (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.anchoSup ?? 2.50}
                            onChange={(e) => actualizarEspacio(espacio.id, 'anchoSup', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Largo Total Izquierdo (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.largoIzq ?? 2.60}
                            onChange={(e) => actualizarEspacio(espacio.id, 'largoIzq', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Ancho Tramo Inferior (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.anchoInf ?? 1.70}
                            onChange={(e) => actualizarEspacio(espacio.id, 'anchoInf', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">Profundidad del Quiebre (m)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={espacio.profQuiebre ?? 0.40}
                            onChange={(e) => actualizarEspacio(espacio.id, 'profQuiebre', e.target.value)}
                            className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Posición del Quiebre</label>
                        <select
                          value={espacio.posQuiebre || 'inf_der'}
                          onChange={(e) => actualizarEspacio(espacio.id, 'posQuiebre', e.target.value)}
                          className="block w-full rounded-lg border-slate-800 bg-slate-900/40 px-3 py-1.5 text-slate-200 text-xs border"
                        >
                          <option value="inf_der">Inferior Derecha</option>
                          <option value="inf_izq">Inferior Izquierda</option>
                          <option value="sup_der">Superior Derecha</option>
                          <option value="sup_izq">Superior Izquierda</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Polygon Vertices Editor */}
                  {tipo === 'polygon' && (
                    <div className="space-y-3 bg-slate-950/40 p-3.5 rounded-xl border border-slate-850">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider">Vértices del Polígono (metros):</p>
                        <button
                          type="button"
                          onClick={() => addVertex(espacio.id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-[10px] text-indigo-300 hover:text-white font-semibold rounded-lg transition-all cursor-pointer"
                        >
                          Añadir
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {espacio.vertices?.map((vertex, vIdx) => (
                          <div key={vIdx} className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-lg border border-slate-800/40">
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center text-[9px] font-bold">
                              {vIdx + 1}
                            </span>
                            <div className="grid grid-cols-2 gap-2 flex-1">
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-slate-500">X:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={vertex.x}
                                  onChange={(e) => handleVertexChange(espacio.id, vIdx, 'x', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-200 text-center"
                                />
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                <span className="text-slate-500">Y:</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={vertex.y}
                                  onChange={(e) => handleVertexChange(espacio.id, vIdx, 'y', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-850 px-2 py-0.5 rounded text-slate-200 text-center"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeVertex(espacio.id, vIdx)}
                              disabled={(espacio.vertices?.length || 0) <= 3}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
                      className="block w-full rounded-xl border-slate-800 bg-slate-900/60 px-3 py-2 text-slate-200 text-sm border focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="auto">Automático (Optimizar Desperdicio)</option>
                      <option value="largo">A lo Largo (Paralelo a la longitud)</option>
                      <option value="ancho">A lo Ancho (Paralelo a la latitud)</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
