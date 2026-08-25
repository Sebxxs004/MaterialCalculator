export interface PVCConfig {
  largoComercial: number; // in meters, e.g., 5.95
  anchoUtil: number;      // in meters, e.g., 0.25
  precioPorLamina: number; // in currency, e.g., 25000
}

export type Orientacion = 'auto' | 'largo' | 'ancho';
export type TipoEspacio = 'rectangular' | 'l_shape' | 'polygon' | 'mocheta';

export interface Espacio {
  id: string;
  nombre: string;
  largo: number; // in meters
  ancho: number; // in meters
  orientacionSeleccionada: Orientacion;
  
  // Phase 7 & 8 Irregular Spaces
  tipo?: TipoEspacio;
  vertices?: { x: number; y: number }[];
  largoA?: number;
  largoB?: number;
  anchoA?: number;
  anchoB?: number;

  // Mocheta / Cutout Preset details
  anchoSup?: number;
  largoIzq?: number;
  anchoInf?: number;
  profQuiebre?: number;
  posQuiebre?: 'inf_der' | 'inf_izq' | 'sup_der' | 'sup_izq';
}

export interface PiezaSobrante {
  longitud: number; // length of the leftover piece in meters
  cantidad: number;
}

export interface ResultadoOptimizacion {
  metrosUsados: number;
  laminasTotales: number;
  porcentajeDesperdicio: number;
  piezasSobrantes: PiezaSobrante[];
}

export interface ProyectoGuardado {
  id: string;
  nombreProyecto: string;
  cliente: string;
  fecha: string; // ISO string or formatted date
  espacios: Espacio[];
  pvcConfig: PVCConfig;
  canvasDataURL: string; // Base64 string of the project render
  threeDDataURL?: string; // Base64 string of the 3D room render
  estadoJSON: string;    // JSON string for raw state backup/restore
}

// Phase 2 Optimization Engine Interfaces
export interface CorteOptimo {
  id: string;
  largo: number;
  espacioId: string;
  espacioNombre: string;
  hileraIndex: number;
  
  // Phase 7 Irregular geometry cuts polygon
  poligonoRecortado?: [number, number][][]; 
}

export interface LaminaComercialOptimizada {
  id: string;
  cortes: CorteOptimo[];
  longitudRestante: number;
}

export interface DesgloseEspacio {
  spaceId?: string; // fallback matching if needed
  espacioId: string;
  espacioNombre: string;
  orientacionElegida: 'largo' | 'ancho';
  hilerasRequeridas: number;
  cortesRequeridos: number[];
}

export interface ResultadoConsolidado {
  laminasComerciales: LaminaComercialOptimizada[];
  desgloseEspacios: DesgloseEspacio[];
  totalLaminas: number;
  desperdicioGlobalPorcentaje: number;
}
