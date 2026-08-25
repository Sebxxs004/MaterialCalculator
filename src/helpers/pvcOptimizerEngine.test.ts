import { pvcOptimizerEngine } from './pvcOptimizerEngine';
import type { Espacio, PVCConfig } from '../types/material';

const config: PVCConfig = {
  largoComercial: 5.95,
  anchoUtil: 0.25,
  precioPorLamina: 25000,
};

function testLHabitacion() {
  console.log('🧪 Ejecutando Test: Habitación en L...');
  const espacioL: Espacio = {
    id: 'l-room',
    nombre: 'Habitación en L de Prueba',
    largo: 5.0,
    ancho: 4.0,
    orientacionSeleccionada: 'auto',
    tipo: 'l_shape',
    largoA: 3.0, // vertical leg length
    anchoA: 2.0, // horizontal leg width
  };

  const res = pvcOptimizerEngine.optimizarCortes([espacioL], config);

  console.log(`- Orientación elegida: ${res.desgloseEspacios[0].orientacionElegida}`);
  console.log(`- Hileras requeridas: ${res.desgloseEspacios[0].hilerasRequeridas}`);
  console.log(`- Láminas de fábrica necesarias: ${res.totalLaminas}`);
  console.log(`- Desperdicio global: ${res.desperdicioGlobalPorcentaje}%`);

  if (res.totalLaminas <= 0) {
    throw new Error('FALLIDO: La cantidad de láminas comerciales calculadas debe ser mayor a 0.');
  }
  console.log('✅ Test de Habitación en L: PASADO.\n');
}

function testFalsaEscuadra() {
  console.log('🧪 Ejecutando Test: Cuarto con Falsa Escuadra (Diagonal 45°)...');
  const espacioDiagonal: Espacio = {
    id: 'slant-room',
    nombre: 'Cuarto Diagonal 45°',
    largo: 4.0,
    ancho: 4.0,
    orientacionSeleccionada: 'auto',
    tipo: 'polygon',
    vertices: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 2 }, // Corner cut start
      { x: 2, y: 4 }, // Slanted line at 45 deg
      { x: 0, y: 4 },
    ],
  };

  const res = pvcOptimizerEngine.optimizarCortes([espacioDiagonal], config);

  console.log(`- Orientación elegida: ${res.desgloseEspacios[0].orientacionElegida}`);
  console.log(`- Hileras requeridas: ${res.desgloseEspacios[0].hilerasRequeridas}`);
  console.log(`- Láminas de fábrica necesarias: ${res.totalLaminas}`);
  console.log(`- Desperdicio global: ${res.desperdicioGlobalPorcentaje}%`);

  if (res.totalLaminas <= 0) {
    throw new Error('FALLIDO: La cantidad de láminas comerciales calculadas debe ser mayor a 0.');
  }
  console.log('✅ Test de Falsa Escuadra (Diagonal 45°): PASADO.\n');
}

try {
  testLHabitacion();
  testFalsaEscuadra();
  console.log('🎉 ¡Todos los tests unitarios pasaron con éxito!');
} catch (error: any) {
  console.error('❌ Error durante la ejecución de los tests unitarios:', error.message);
  throw error;
}
