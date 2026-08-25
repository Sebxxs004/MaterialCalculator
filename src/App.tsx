import { useState, useEffect, useRef } from 'react';
import type { PVCConfig, Espacio, ResultadoConsolidado, ProyectoGuardado } from './types/material';
import { projectStorageService } from './services/projectStorageService';
import { pvcOptimizerEngine } from './helpers/pvcOptimizerEngine';
import { PVCConfigForm } from './components/PVCConfigForm';
import { EspaciosForm } from './components/EspaciosForm';
import { HistorialProyectos } from './components/HistorialProyectos';
import { RoomCanvasVisualizer, type RoomCanvasVisualizerRef } from './components/RoomCanvasVisualizer';
import { Room3DViewer } from './components/Room3DViewer';
import { MasterCuttingSheet } from './components/MasterCuttingSheet';
import { ProjectHistoryModal } from './components/ProjectHistoryModal';
import { 
  Save, 
  Plus, 
  Layers,
  Calculator, 
  User,
  FolderDot,
  FolderOpen,
  Eye
} from 'lucide-react';

const DEFAULT_PVC_CONFIG: PVCConfig = {
  largoComercial: 5.95,
  anchoUtil: 0.25,
  precioPorLamina: 28000,
};

const DEFAULT_ESPACIO: Espacio = {
  id: crypto.randomUUID(),
  nombre: 'Sala Principal',
  largo: 4.5,
  ancho: 3.5,
  orientacionSeleccionada: 'auto',
};

export default function App() {
  // State for Project Metadata
  const [nombreProyecto, setNombreProyecto] = useState<string>('Proyecto PVC Centro');
  const [cliente, setCliente] = useState<string>('Cliente Particular');
  const [proyectoActivoId, setProyectoActivoId] = useState<string | undefined>(undefined);

  // Material Config
  const [pvcConfig, setPvcConfig] = useState<PVCConfig>(DEFAULT_PVC_CONFIG);

  // Spaces
  const [espacios, setEspacios] = useState<Espacio[]>([DEFAULT_ESPACIO]);
  const [espacioActivoId, setEspacioActivoId] = useState<string>(DEFAULT_ESPACIO.id);

  // Active Tab for visualizer: '2d' | '3d'
  const [vistaActiva, setVistaActiva] = useState<'2d' | '3d'>('2d');

  // History List and Modal Open State
  const [historialProyectos, setHistorialProyectos] = useState<ProyectoGuardado[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Consolidated Optimizer Result
  const [resultadoConsolidado, setResultadoConsolidado] = useState<ResultadoConsolidado | null>(null);

  // Cross-highlight state between Canvas 2D and cutting list
  const [hoveredCorteId, setHoveredCorteId] = useState<string | null>(null);

  // Ref for Room Canvas Visualizer Component
  const visualizerRef = useRef<RoomCanvasVisualizerRef | null>(null);

  // 3D canvas snapshot state for PDF reporting
  const [threeDImageActive, setThreeDImageActive] = useState<string | null>(null);

  const handle3DImageCapture = (dataUrl: string) => {
    setThreeDImageActive(dataUrl);
    if (espacioActivoId) {
      setEspacios(prev =>
        prev.map(e => e.id === espacioActivoId ? { ...e, threeDDataURL: dataUrl } : e)
      );
    }
  };

  // Load history from IndexedDB on startup
  useEffect(() => {
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    try {
      const proyectos = await projectStorageService.obtenerProyectos();
      setHistorialProyectos(proyectos);
    } catch (err) {
      console.error(err);
    }
  };

  // Run calculation when configuration or spaces change
  useEffect(() => {
    const res = pvcOptimizerEngine.optimizarCortes(espacios, pvcConfig);
    setResultadoConsolidado(res);
  }, [espacios, pvcConfig]);

  const guardarProyectoActual = async () => {
    try {
      const canvasDataURL = visualizerRef.current?.captureCanvasSnapshot() || '';
      
      const id = proyectoActivoId || crypto.randomUUID();
      const nuevoProyecto: ProyectoGuardado = {
        id,
        nombreProyecto,
        cliente,
        fecha: new Date().toISOString(),
        espacios,
        pvcConfig,
        canvasDataURL,
        threeDDataURL: threeDImageActive || undefined,
        estadoJSON: JSON.stringify({ espacios, pvcConfig, nombreProyecto, cliente }),
      };

      await projectStorageService.guardarProyecto(nuevoProyecto);
      setProyectoActivoId(id);
      await cargarHistorial();
      alert('¡Proyecto guardado exitosamente!');
    } catch (err) {
      alert('Error al guardar el proyecto en IndexedDB.');
      console.error(err);
    }
  };

  const cargarProyecto = (proyecto: ProyectoGuardado) => {
    try {
      const raw = JSON.parse(proyecto.estadoJSON);
      setEspacios(raw.espacios);
      setPvcConfig(raw.pvcConfig);
      setNombreProyecto(raw.nombreProyecto);
      setCliente(raw.cliente);
      setProyectoActivoId(proyecto.id);
      if (raw.espacios.length > 0) {
        setEspacioActivoId(raw.espacios[0].id);
      }
      setIsHistoryModalOpen(false);
    } catch (err) {
      console.error('Error al decodificar el estado del proyecto', err);
      // Fallback a propiedades raíz si no tiene backup JSON
      setEspacios(proyecto.espacios);
      setPvcConfig(proyecto.pvcConfig);
      setNombreProyecto(proyecto.nombreProyecto);
      setCliente(proyecto.cliente);
      setProyectoActivoId(proyecto.id);
      if (proyecto.espacios.length > 0) {
        setEspacioActivoId(proyecto.espacios[0].id);
      }
      setIsHistoryModalOpen(false);
    }
  };

  const eliminarProyecto = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este proyecto de la base de datos?')) {
      try {
        await projectStorageService.eliminarProyecto(id);
        if (proyectoActivoId === id) {
          iniciarNuevoProyecto();
        }
        await cargarHistorial();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const iniciarNuevoProyecto = () => {
    setNombreProyecto('Proyecto PVC Centro');
    setCliente('Cliente Particular');
    setProyectoActivoId(undefined);
    setPvcConfig(DEFAULT_PVC_CONFIG);
    const id = crypto.randomUUID();
    const nuevoEspacio = { ...DEFAULT_ESPACIO, id };
    setEspacios([nuevoEspacio]);
    setEspacioActivoId(id);
    setHoveredCorteId(null);
  };

  const handleOrientacionChange = (nuevaOrientacion: 'auto' | 'largo' | 'ancho') => {
    setEspacios(
      espacios.map((esp) => 
        esp.id === espacioActivoId 
          ? { ...esp, orientacionSeleccionada: nuevaOrientacion } 
          : esp
      )
    );
  };

  const espacioActivo = espacios.find(e => e.id === espacioActivoId) || espacios[0];

  // General project totals
  const totalLaminasProyecto = resultadoConsolidado ? resultadoConsolidado.totalLaminas : 0;
  const costoTotalProyecto = totalLaminasProyecto * pvcConfig.precioPorLamina;

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 flex flex-col font-sans Outfit selection:bg-indigo-600/30 selection:text-indigo-200">
      
      {/* Premium Gradient Header Block */}
      <header className="bg-slate-900/40 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                MaterialCalculator
              </h1>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Optimización de Cielo Raso PVC</p>
            </div>
          </div>

          {/* Project Details Inline Editor */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            <div className="relative">
              <FolderDot className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={nombreProyecto}
                onChange={(e) => setNombreProyecto(e.target.value)}
                placeholder="Nombre del Proyecto"
                className="w-full md:w-48 rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nombre Cliente"
                className="w-full md:w-48 rounded-xl border border-slate-800 bg-slate-900/60 pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <button
              onClick={guardarProyectoActual}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-indigo-500/25 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all border border-slate-700/60 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" />
              Historial
            </button>
            <button
              onClick={iniciarNuevoProyecto}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-all border border-slate-700/60 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo
            </button>
          </div>
        </div>
      </header>

      {/* Exporter Container Wrapper */}
      <div id="main-content-to-export" className="w-full flex-1 flex flex-col bg-[#070b13]">
        {/* Main Grid */}
        <main className="max-w-7xl mx-auto px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          {/* Sidebar Panel - History */}
          <section className="lg:col-span-3 no-export-pdf">
            <HistorialProyectos
              proyectos={historialProyectos}
              onSeleccionar={cargarProyecto}
              onEliminar={eliminarProyecto}
              proyectoActivoId={proyectoActivoId}
            />
          </section>

          {/* Inputs Configuration - Forms */}
          <section className="lg:col-span-4 space-y-8 no-export-pdf">
            <PVCConfigForm config={pvcConfig} onChange={setPvcConfig} />
            <EspaciosForm espacios={espacios} onChange={setEspacios} />
          </section>

          {/* Outputs, Visualizations and Guides */}
          <section className="lg:col-span-5 space-y-8 flex flex-col">
            <div className="grid grid-cols-1 gap-6">
              {/* Tab Switcher for 2D vs 3D */}
              <div className="flex justify-between items-center bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 pl-3">Visualizador de Techo</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setVistaActiva('2d')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      vistaActiva === '2d'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Plano 2D
                  </button>
                  <button
                    onClick={() => setVistaActiva('3d')}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      vistaActiva === '3d'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 animate-pulse" />
                    Vista 3D
                  </button>
                </div>
              </div>

              {/* Conditional rendering of 2D or 3D viewports */}
              {espacioActivo && (
                <div className="transition-all duration-300">
                  {vistaActiva === '2d' ? (
                    <RoomCanvasVisualizer
                      ref={visualizerRef}
                      espacio={espacioActivo}
                      config={pvcConfig}
                      resultadoConsolidado={resultadoConsolidado}
                      onOrientacionChange={handleOrientacionChange}
                      hoveredCorteId={hoveredCorteId}
                      onHoverCorte={setHoveredCorteId}
                    />
                  ) : (
                    <Room3DViewer
                      espacio={espacioActivo}
                      config={pvcConfig}
                      resultadoConsolidado={resultadoConsolidado}
                      onCapture={handle3DImageCapture}
                    />
                  )}
                </div>
              )}

              {/* General Project Summary Card */}
              <div className="bg-gradient-to-br from-indigo-900/25 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-4">Resumen General</h3>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Total Habitaciones:</span>
                      <span className="font-bold text-sm text-slate-200">{espacios.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Láminas PVC (5.95m):</span>
                      <span className="font-bold text-sm text-indigo-400">{totalLaminasProyecto} uds</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Desperdicio Global:</span>
                      <span className={`font-bold text-sm ${
                        (resultadoConsolidado?.desperdicioGlobalPorcentaje || 0) > 15 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {resultadoConsolidado?.desperdicioGlobalPorcentaje}%
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-500 block">Costo de Compra:</span>
                      <span className="font-bold text-sm text-emerald-400">
                        ${costoTotalProyecto.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Space Selector (Bottom of Visualizer Area) */}
            {espacios.length > 1 && (
              <div className="flex flex-wrap gap-1.5 w-full justify-center">
                {espacios.map((esp) => (
                  <button
                    key={esp.id}
                    onClick={() => setEspacioActivoId(esp.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      espacioActivoId === esp.id
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {esp.nombre || 'Sin Nombre'}
                  </button>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Master Cutting Sheet visual guide (Full width bottom panel) */}
        {resultadoConsolidado && resultadoConsolidado.laminasComerciales.length > 0 && (
          <section className="max-w-7xl mx-auto px-6 pb-12 w-full">
            <MasterCuttingSheet
              resultadoConsolidado={resultadoConsolidado}
              espacios={espacios}
              pvcConfig={pvcConfig}
              nombreProyecto={nombreProyecto}
              hoveredCorteId={hoveredCorteId}
              onHoverCorte={setHoveredCorteId}
            />
          </section>
        )}
      </div>

      {/* History management Modal */}
      <ProjectHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onSelectProject={cargarProyecto}
      />
    </div>
  );
}
