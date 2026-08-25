import { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { Espacio, PVCConfig, ResultadoConsolidado } from '../types/material';
import * as THREE from 'three';
import { Box, Layout } from 'lucide-react';

interface Room3DViewerProps {
  espacio: Espacio;
  config: PVCConfig;
  resultadoConsolidado: ResultadoConsolidado | null;
}

type Acabado = 'blanco' | 'madera' | 'grafito';
type VistaCamara = 'isometrica' | 'interior' | 'plano';

const FINISH_MATERIALS: Record<Acabado, { color: string; roughness: number; metalness: number }> = {
  blanco: { color: '#f8fafc', roughness: 0.2, metalness: 0.1 },
  madera: { color: '#d97706', roughness: 0.8, metalness: 0.0 }, // Wood orange/brown
  grafito: { color: '#334155', roughness: 0.5, metalness: 0.3 }, // Slate 700 style
};

// Helper camera controller to easily change viewpoints inside R3F context
const CameraController = ({ viewMode, roomW, roomL, roomH }: { viewMode: VistaCamara; roomW: number; roomL: number; roomH: number }) => {
  const { camera } = useThree();

  useEffect(() => {
    const isPerspective = camera instanceof THREE.PerspectiveCamera;
    if (!isPerspective) return;

    const targetPos = new THREE.Vector3();
    const lookAtPos = new THREE.Vector3(0, roomH / 2, 0);

    if (viewMode === 'isometrica') {
      targetPos.set(roomW * 1.5, roomH * 2, roomL * 1.5);
    } else if (viewMode === 'interior') {
      // Position camera close to floor looking straight up
      targetPos.set(0, 0.4, 0);
      lookAtPos.set(0, roomH, 0);
    } else if (viewMode === 'plano') {
      // Top-down looking at ceiling
      targetPos.set(0, roomH * 2.5, 0.01); // Small offset in Z to prevent Gimbal Lock
      lookAtPos.set(0, roomH, 0);
    }

    // Smooth transition or instant snap
    camera.position.copy(targetPos);
    camera.lookAt(lookAtPos);
  }, [viewMode, roomW, roomL, roomH, camera]);

  return null;
};

export const Room3DViewer: React.FC<Room3DViewerProps> = ({ espacio, config, resultadoConsolidado }) => {
  const [acabado, setAcabado] = useState<Acabado>('blanco');
  const [vista, setVista] = useState<VistaCamara>('isometrica');
  const [mostrarOmegas, setMostrarOmegas] = useState(true);

  const { largo, ancho } = espacio;
  const { anchoUtil } = config;
  const alto = 2.60; // Standard room height

  // 3D Cut layout data generation
  const getCutsCoords = () => {
    if (!resultadoConsolidado) return [];

    let orientacionEfectiva = espacio.orientacionSeleccionada;
    if (orientacionEfectiva === 'auto') {
      const desglose = resultadoConsolidado.desgloseEspacios.find(d => d.espacioId === espacio.id);
      orientacionEfectiva = desglose?.orientacionElegida || 'largo';
    }

    const cortesEspacio = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
      lamina.cortes
        .filter(c => c.espacioId === espacio.id)
        .map(c => ({
          ...c,
          isShared: new Set(lamina.cortes.map(x => x.espacioId)).size > 1,
          isFirstInLamina: lamina.cortes[0].id === c.id
        }))
    );

    const coords: {
      id: string;
      x: number;
      y: number;
      z: number;
      w: number;
      l: number;
      h: number;
      corteType: 'nueva' | 'reutilizada' | 'sobrante';
    }[] = [];

    if (orientacionEfectiva === 'largo') {
      const hileras = Math.ceil(ancho / anchoUtil);
      
      for (let hIdx = 0; hIdx < hileras; hIdx++) {
        const cortesHilera = cortesEspacio
          .filter(c => c.hileraIndex === hIdx)
          .sort((a, b) => b.largo - a.largo);

        let currentY = -largo / 2;
        const xCoord = -ancho / 2 + hIdx * anchoUtil + anchoUtil / 2;

        cortesHilera.forEach((corte) => {
          let type: 'nueva' | 'reutilizada' | 'sobrante' = 'nueva';
          if (corte.isShared && !corte.isFirstInLamina) {
            type = 'reutilizada';
          } else if (corte.largo < 1.5 && !corte.isShared) {
            type = 'sobrante';
          }

          coords.push({
            id: corte.id,
            x: xCoord,
            y: currentY + corte.largo / 2,
            z: alto,
            w: anchoUtil - 0.005, // Small gap for grooves
            l: corte.largo - 0.005,
            h: 0.02, // Thickness
            corteType: type,
          });

          currentY += corte.largo;
        });
      }
    } else {
      // Parallel to Width
      const hileras = Math.ceil(largo / anchoUtil);
      
      for (let hIdx = 0; hIdx < hileras; hIdx++) {
        const cortesHilera = cortesEspacio
          .filter(c => c.hileraIndex === hIdx)
          .sort((a, b) => b.largo - a.largo);

        let currentX = -ancho / 2;
        const yCoord = -largo / 2 + hIdx * anchoUtil + anchoUtil / 2;

        cortesHilera.forEach((corte) => {
          let type: 'nueva' | 'reutilizada' | 'sobrante' = 'nueva';
          if (corte.isShared && !corte.isFirstInLamina) {
            type = 'reutilizada';
          } else if (corte.largo < 1.5 && !corte.isShared) {
            type = 'sobrante';
          }

          coords.push({
            id: corte.id,
            x: currentX + corte.largo / 2,
            y: yCoord,
            z: alto,
            w: corte.largo - 0.005,
            l: anchoUtil - 0.005,
            h: 0.02,
            corteType: type,
          });

          currentX += corte.largo;
        });
      }
    }

    return coords;
  };

  const cortes3D = getCutsCoords();

  // Color mapper based on cut source and active finish material
  const getCutColor = (type: 'nueva' | 'reutilizada' | 'sobrante') => {
    if (type === 'reutilizada') return '#10b981'; // Green tint
    if (type === 'sobrante') return '#f59e0b'; // Orange tint
    return FINISH_MATERIALS[acabado].color;
  };

  // Generate omega coordinates (spaced every 0.6m)
  const getOmegasCoords = () => {
    let orientacionEfectiva = espacio.orientacionSeleccionada;
    if (orientacionEfectiva === 'auto' && resultadoConsolidado) {
      const desglose = resultadoConsolidado.desgloseEspacios.find(d => d.espacioId === espacio.id);
      orientacionEfectiva = desglose?.orientacionElegida || 'largo';
    }
    if (orientacionEfectiva === 'auto') orientacionEfectiva = 'largo';

    const list: { x: number; y: number; z: number; w: number; l: number; h: number }[] = [];
    const step = 0.60;

    if (orientacionEfectiva === 'largo') {
      // Omegas run perpendicular, so parallel to width (along X axis)
      const numOmegas = Math.floor(largo / step);
      for (let i = 0; i <= numOmegas; i++) {
        const y = -largo / 2 + i * step;
        list.push({
          x: 0,
          y,
          z: alto + 0.03, // placed above the PVC ceiling
          w: ancho,
          l: 0.04, // Omega profile width
          h: 0.02, // Height
        });
      }
    } else {
      // Omegas run parallel to length (along Y axis)
      const numOmegas = Math.floor(ancho / step);
      for (let i = 0; i <= numOmegas; i++) {
        const x = -ancho / 2 + i * step;
        list.push({
          x,
          y: 0,
          z: alto + 0.03,
          w: 0.04,
          l: largo,
          h: 0.02,
        });
      }
    }
    return list;
  };

  const omegas3D = getOmegasCoords();

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col items-center w-full relative">
      {/* 3D Canvas Header Controls overlay */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 mb-4 z-10">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Box className="w-4 h-4 text-violet-400" />
          Vista 3D Interactiva
        </h2>

        {/* Cam views selector */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setVista('isometrica')}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
              vista === 'isometrica' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Isométrica
          </button>
          <button
            onClick={() => setVista('interior')}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
              vista === 'interior' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mirar Techo
          </button>
          <button
            onClick={() => setVista('plano')}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
              vista === 'plano' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Techo 2D
          </button>
        </div>
      </div>

      {/* R3F Canvas Container */}
      <div className="relative w-full aspect-square max-w-[340px] md:max-w-none md:h-[300px] rounded-xl overflow-hidden border border-slate-800 bg-[#0b0f19]">
        <Canvas shadows>
          <PerspectiveCamera makeDefault position={[largo * 1.5, alto * 2.2, ancho * 1.5]} fov={50} />
          <CameraController viewMode={vista} roomW={ancho} roomL={largo} roomH={alto} />
          <OrbitControls 
            enableDamping 
            maxPolarAngle={Math.PI / 1.9} // Prevent looking below ground
            minDistance={1.5}
            maxDistance={20}
          />

          {/* Lights */}
          <ambientLight intensity={0.4} />
          <directionalLight 
            position={[5, 10, 5]} 
            intensity={0.6} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
          />
          
          {/* Recessed ceiling downlight spots */}
          <pointLight position={[0, alto - 0.2, 0]} intensity={1.2} distance={6} decay={2} castShadow />
          <spotLight 
            position={[0, alto - 0.1, 0]} 
            angle={Math.PI / 3} 
            penumbra={0.5} 
            intensity={1.5} 
            distance={8} 
            castShadow
          />

          {/* Floor mesh */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[ancho, largo]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>

          {/* Floor grid helper */}
          <gridHelper args={[Math.max(ancho, largo) * 2, 10, '#334155', '#1e293b']} position={[0, 0.01, 0]} />

          {/* Semi-transparent perimeter walls */}
          {/* North Wall */}
          <mesh position={[0, alto / 2, -largo / 2]}>
            <boxGeometry args={[ancho, alto, 0.08]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>
          {/* South Wall */}
          <mesh position={[0, alto / 2, largo / 2]}>
            <boxGeometry args={[ancho, alto, 0.08]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>
          {/* East Wall */}
          <mesh position={[ancho / 2, alto / 2, 0]}>
            <boxGeometry args={[0.08, alto, largo]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>
          {/* West Wall */}
          <mesh position={[-ancho / 2, alto / 2, 0]}>
            <boxGeometry args={[0.08, alto, largo]} />
            <meshStandardMaterial color="#475569" transparent opacity={0.3} />
          </mesh>

          {/* J Molding Perimeter Crown framing (Z=alto) */}
          <mesh position={[0, alto - 0.01, 0]}>
            <boxGeometry args={[ancho, 0.02, largo]} />
            <meshStandardMaterial color="#0f172a" wireframe />
          </mesh>

          {/* PVC ceiling slats rendering */}
          {cortes3D.map((corte) => (
            <mesh key={corte.id} position={[corte.x, corte.z, corte.y]} castShadow receiveShadow>
              <boxGeometry args={[corte.w, corte.h, corte.l]} />
              <meshStandardMaterial
                color={getCutColor(corte.corteType)}
                roughness={FINISH_MATERIALS[acabado].roughness}
                metalness={FINISH_MATERIALS[acabado].metalness}
              />
            </mesh>
          ))}

          {/* Metallic Omega support profile framing */}
          {mostrarOmegas && omegas3D.map((omega, index) => (
            <mesh key={index} position={[omega.x, omega.z, omega.y]}>
              <boxGeometry args={[omega.w, omega.h, omega.l]} />
              <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
            </mesh>
          ))}
        </Canvas>
      </div>

      {/* 3D UI controls overlay overlay */}
      <div className="mt-4 w-full space-y-3.5 border-t border-slate-800/80 pt-3">
        {/* Slats Finish materials */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1.5">
            <Layout className="w-3.5 h-3.5 text-slate-400" />
            Acabado del PVC
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['blanco', 'madera', 'grafito'] as Acabado[]).map((fin) => (
              <button
                key={fin}
                onClick={() => setAcabado(fin)}
                className={`py-2 px-2 rounded-xl text-xs font-semibold border capitalize transition-all cursor-pointer ${
                  acabado === fin
                    ? 'bg-slate-900 border-indigo-500 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {fin === 'madera' ? 'Madera' : fin === 'grafito' ? 'Grafito' : 'Blanco'}
              </button>
            ))}
          </div>
        </div>

        {/* Support omegas visibility toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-400 font-medium">Estructura Perfiles Omega (Techo)</span>
          <button
            onClick={() => setMostrarOmegas(!mostrarOmegas)}
            className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
              mostrarOmegas
                ? 'bg-indigo-600/15 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {mostrarOmegas ? 'Mostrar' : 'Ocultar'}
          </button>
        </div>
      </div>
    </div>
  );
};
