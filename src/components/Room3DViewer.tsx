import { useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { Espacio, PVCConfig, ResultadoConsolidado } from '../types/material';
import { obtenerVerticesDeEspacio } from '../helpers/pvcOptimizerEngine';
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
  madera: { color: '#d97706', roughness: 0.8, metalness: 0.0 }, // Warm wood
  grafito: { color: '#334155', roughness: 0.5, metalness: 0.3 }, // Slate matte
};

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
      targetPos.set(0, 0.4, 0);
      lookAtPos.set(0, roomH, 0);
    } else if (viewMode === 'plano') {
      targetPos.set(0, roomH * 2.5, 0.01);
      lookAtPos.set(0, roomH, 0);
    }

    camera.position.copy(targetPos);
    camera.lookAt(lookAtPos);
  }, [viewMode, roomW, roomL, roomH, camera]);

  return null;
};

export const Room3DViewer: React.FC<Room3DViewerProps> = ({ espacio, config: _config, resultadoConsolidado }) => {
  const [acabado, setAcabado] = useState<Acabado>('blanco');
  const [vista, setVista] = useState<VistaCamara>('isometrica');
  const [mostrarOmegas, setMostrarOmegas] = useState(true);

  const vertices = obtenerVerticesDeEspacio(espacio);
  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const ancho = maxX - minX;
  const largo = maxY - minY;
  const alto = 2.60; // Standard room height

  // Floor shape geometry creation
  const floorShape = new THREE.Shape();
  vertices.forEach((v, idx) => {
    const px = v.x - minX - ancho / 2;
    const pz = v.y - minY - largo / 2;
    if (idx === 0) floorShape.moveTo(px, pz);
    else floorShape.lineTo(px, pz);
  });

  // Slats 3D geometry from clipping polygons
  const getSlatMeshes = () => {
    if (!resultadoConsolidado) return [];

    const cortesEspacio = resultadoConsolidado.laminasComerciales.flatMap(lamina =>
      lamina.cortes
        .filter(c => c.espacioId === espacio.id)
        .map(c => ({
          ...c,
          isShared: new Set(lamina.cortes.map(x => x.espacioId)).size > 1,
          isFirstInLamina: lamina.cortes[0].id === c.id
        }))
    );

    const meshes: {
      id: string;
      shape: THREE.Shape;
      corteType: 'nueva' | 'reutilizada' | 'sobrante';
    }[] = [];

    cortesEspacio.forEach((corte) => {
      if (!corte.poligonoRecortado || corte.poligonoRecortado.length === 0) return;

      corte.poligonoRecortado.forEach((ring) => {
        if (ring.length < 3) return;
        
        const shape = new THREE.Shape();
        ring.forEach((pt, idx) => {
          const px = pt[0] - minX - ancho / 2;
          const pz = pt[1] - minY - largo / 2;
          if (idx === 0) shape.moveTo(px, pz);
          else shape.lineTo(px, pz);
        });

        let type: 'nueva' | 'reutilizada' | 'sobrante' = 'nueva';
        if (corte.isShared && !corte.isFirstInLamina) {
          type = 'reutilizada';
        } else if (corte.largo < 1.5 && !corte.isShared) {
          type = 'sobrante';
        }

        meshes.push({
          id: corte.id + '-' + Math.random(),
          shape,
          corteType: type
        });
      });
    });

    return meshes;
  };

  const slats3D = getSlatMeshes();

  // Perimeter wall segments box parameters calculations
  const getWallSegments = () => {
    const list: {
      id: string;
      px: number;
      py: number;
      pz: number;
      length: number;
      rotation: number;
    }[] = [];

    vertices.forEach((v1, idx) => {
      const v2 = vertices[(idx + 1) % vertices.length];
      const length = Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2));
      
      if (length < 0.01) return;

      const mx = (v1.x + v2.x) / 2 - minX - ancho / 2;
      const mz = (v1.y + v2.y) / 2 - minY - largo / 2;
      const angle = Math.atan2(v2.y - v1.y, v2.x - v1.x);

      list.push({
        id: `wall-${idx}`,
        px: mx,
        py: alto / 2,
        pz: mz,
        length,
        rotation: -angle // Match clockwise angle coordinate system rotation direction
      });
    });

    return list;
  };

  const walls3D = getWallSegments();

  const getCutColor = (type: 'nueva' | 'reutilizada' | 'sobrante') => {
    if (type === 'reutilizada') return '#10b981'; // Green
    if (type === 'sobrante') return '#f59e0b'; // Orange
    return FINISH_MATERIALS[acabado].color;
  };

  // Generate support omega profiles centered on the bounding box
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
      // Omegas run along X axis
      const numOmegas = Math.floor(largo / step);
      for (let i = 0; i <= numOmegas; i++) {
        const y = -largo / 2 + i * step;
        list.push({
          x: 0,
          y,
          z: alto + 0.03,
          w: ancho,
          l: 0.04,
          h: 0.02,
        });
      }
    } else {
      // Omegas run along Y axis
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
      {/* 3D Canvas Header Controls */}
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
          <PerspectiveCamera makeDefault position={[ancho * 1.5, alto * 2.2, largo * 1.5]} fov={50} />
          <CameraController viewMode={vista} roomW={ancho} roomL={largo} roomH={alto} />
          <OrbitControls 
            enableDamping 
            maxPolarAngle={Math.PI / 1.9}
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
          
          {/* Recessed spots */}
          <pointLight position={[0, alto - 0.2, 0]} intensity={1.2} distance={6} decay={2} castShadow />

          {/* Floor mesh using custom ShapeGeometry */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
            <shapeGeometry args={[floorShape]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>

          {/* Grid helper */}
          <gridHelper args={[Math.max(ancho, largo) * 3, 15, '#334155', '#161d2d']} position={[0, 0, 0]} />

          {/* Sectional perimeter walls box segment extrusion */}
          {walls3D.map((wall) => (
            <mesh key={wall.id} position={[wall.px, wall.py, wall.pz]} rotation={[0, wall.rotation, 0]}>
              <boxGeometry args={[wall.length, alto, 0.06]} />
              <meshStandardMaterial color="#475569" transparent opacity={0.35} />
            </mesh>
          ))}

          {/* PVC ceiling slats rendering using custom ShapeGeometry */}
          {slats3D.map((slat) => (
            <mesh key={slat.id} rotation={[-Math.PI / 2, 0, 0]} position={[0, alto, 0]} castShadow receiveShadow>
              <shapeGeometry args={[slat.shape]} />
              <meshStandardMaterial
                color={getCutColor(slat.corteType)}
                roughness={FINISH_MATERIALS[acabado].roughness}
                metalness={FINISH_MATERIALS[acabado].metalness}
                side={THREE.DoubleSide}
                transparent={mostrarOmegas}
                opacity={mostrarOmegas ? 0.60 : 1.0}
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

      {/* Acabado and toggles UI controls */}
      <div className="mt-4 w-full space-y-3.5 border-t border-slate-800/80 pt-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
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
