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

function testMocheta() {
  console.log('🧪 Ejecutando Test: Habitación con Mocheta / Quiebre en L...');
  const espacioMocheta: Espacio = {
    id: 'mocheta-room',
    nombre: 'Habitación con Mocheta',
    largo: 2.60,
    ancho: 2.50,
    orientacionSeleccionada: 'ancho', // Force orientation parallel to width
    tipo: 'mocheta',
    anchoSup: 2.50,
    largoIzq: 2.60,
    anchoInf: 1.70,
    profQuiebre: 0.40,
    posQuiebre: 'inf_der',
  };

  const res = pvcOptimizerEngine.optimizarCortes([espacioMocheta], config);

  console.log(`- Orientación elegida: ${res.desgloseEspacios[0].orientacionElegida}`);
  console.log(`- Hileras requeridas: ${res.desgloseEspacios[0].hilerasRequeridas}`);
  
  const cuts = res.laminasComerciales.flatMap(l => l.cortes);
  const cuts250 = cuts.filter(c => Math.abs(c.largo - 2.50) < 0.05).length;
  const cuts170 = cuts.filter(c => Math.abs(c.largo - 1.70) < 0.05).length;
  
  console.log(`- Cortes de 2.50m generados: ${cuts250} (Esperado: 9)`);
  console.log(`- Cortes de 1.70m generados: ${cuts170} (Esperado: 2)`);
  console.log(`- Láminas de fábrica necesarias: ${res.totalLaminas}`);

  if (cuts250 !== 9 || cuts170 !== 2) {
    throw new Error(`FALLIDO: Se esperaban 9 cortes de 2.50m y 2 cortes de 1.70m, pero se obtuvieron ${cuts250} y ${cuts170}`);
  }
  console.log('✅ Test de Habitación con Mocheta: PASADO.\n');
}

try {
  testLHabitacion();
  testFalsaEscuadra();
  testMocheta();
  console.log('🎉 ¡Todos los tests unitarios pasaron con éxito!');
} catch (error: any) {
  console.error('❌ Error durante la ejecución de los tests unitarios:', error.message);
  throw error;
}
