import type { Espacio, PVCConfig, ResultadoConsolidado, CorteOptimo, LaminaComercialOptimizada, DesgloseEspacio } from '../types/material';

// Helper to generate cut lengths for a single row of a space
function generarCortesParaFila(longitudFila: number, largoComercial: number): number[] {
  const cortes: number[] = [];
  let restante = longitudFila;
  while (restante > 0) {
    if (restante > largoComercial) {
      cortes.push(largoComercial);
      restante -= largoComercial;
    } else {
      // Rounded to 3 decimal places to avoid precision errors
      cortes.push(parseFloat(restante.toFixed(3)));
      restante = 0;
    }
  }
  return cortes;
}

// BFD Bin Packing simulator for single space evaluation
function simularBinPacking(cortes: number[], largoComercial: number): number {
  const sortedCuts = [...cortes].sort((a, b) => b - a);
  const bins: number[] = []; // capacities left in each bin

  for (const cut of sortedCuts) {
    let bestBinIdx = -1;
    let minRemaining = Infinity;

    for (let i = 0; i < bins.length; i++) {
      if (bins[i] >= cut && bins[i] - cut < minRemaining) {
        minRemaining = bins[i] - cut;
        bestBinIdx = i;
      }
    }

    if (bestBinIdx !== -1) {
      bins[bestBinIdx] = parseFloat((bins[bestBinIdx] - cut).toFixed(3));
    } else {
      bins.push(parseFloat((largoComercial - cut).toFixed(3)));
    }
  }

  return bins.length;
}

export const pvcOptimizerEngine = {
  optimizarCortes(espacios: Espacio[], config: PVCConfig): ResultadoConsolidado {
    const { largoComercial, anchoUtil } = config;
    
    if (espacios.length === 0 || !largoComercial || !anchoUtil) {
      return {
        laminasComerciales: [],
        desgloseEspacios: [],
        totalLaminas: 0,
        desperdicioGlobalPorcentaje: 0
      };
    }

    const desgloseEspacios: DesgloseEspacio[] = [];
    const todosLosCortesRequeridos: CorteOptimo[] = [];

    // 1. Process each space and determine orientation
    for (const espacio of espacios) {
      const { largo, ancho, orientacionSeleccionada } = espacio;

      // Evaluation for Largo
      const hilerasLargo = Math.ceil(ancho / anchoUtil);
      const cortesPorHileraLargo = generarCortesParaFila(largo, largoComercial);
      const todosCortesLargo: number[] = [];
      for (let h = 0; h < hilerasLargo; h++) {
        todosCortesLargo.push(...cortesPorHileraLargo);
      }
      const laminasNecesariasLargo = simularBinPacking(todosCortesLargo, largoComercial);

      // Evaluation for Ancho
      const hilerasAncho = Math.ceil(largo / anchoUtil);
      const cortesPorHileraAncho = generarCortesParaFila(ancho, largoComercial);
      const todosCortesAncho: number[] = [];
      for (let h = 0; h < hilerasAncho; h++) {
        todosCortesAncho.push(...cortesPorHileraAncho);
      }
      const laminasNecesariasAncho = simularBinPacking(todosCortesAncho, largoComercial);

      // Select optimal orientation
      let orientacionElegida: 'largo' | 'ancho';
      if (orientacionSeleccionada === 'auto') {
        orientacionElegida = laminasNecesariasLargo <= laminasNecesariasAncho ? 'largo' : 'ancho';
      } else {
        orientacionElegida = orientacionSeleccionada;
      }

      const hilerasRequeridas = orientacionElegida === 'largo' ? hilerasLargo : hilerasAncho;
      const cortesPorFila = orientacionElegida === 'largo' ? cortesPorHileraLargo : cortesPorHileraAncho;
      
      const cortesRequeridos: number[] = [];
      for (let h = 0; h < hilerasRequeridas; h++) {
        cortesRequeridos.push(...cortesPorFila);
        
        // Add detailed cuts tracking
        cortesPorFila.forEach((largoCorte) => {
          todosLosCortesRequeridos.push({
            id: crypto.randomUUID(),
            largo: largoCorte,
            espacioId: espacio.id,
            espacioNombre: espacio.nombre,
            hileraIndex: h,
          });
        });
      }

      desgloseEspacios.push({
        espacioId: espacio.id,
        espacioNombre: espacio.nombre,
        orientacionElegida,
        hilerasRequeridas,
        cortesRequeridos
      });
    }

    // 2. Bin Packing (Best Fit Decreasing) on consolidated cuts
    // Sort cuts from largest to smallest
    const cortesOrdenados = [...todosLosCortesRequeridos].sort((a, b) => b.largo - a.largo);
    const laminasComerciales: LaminaComercialOptimizada[] = [];

    for (const corte of cortesOrdenados) {
      let bestLaminaIdx = -1;
      let minRemaining = Infinity;

      for (let i = 0; i < laminasComerciales.length; i++) {
        const lamina = laminasComerciales[i];
        if (lamina.longitudRestante >= corte.largo && (lamina.longitudRestante - corte.largo) < minRemaining) {
          minRemaining = lamina.longitudRestante - corte.largo;
          bestLaminaIdx = i;
        }
      }

      if (bestLaminaIdx !== -1) {
        laminasComerciales[bestLaminaIdx].cortes.push(corte);
        laminasComerciales[bestLaminaIdx].longitudRestante = parseFloat(
          (laminasComerciales[bestLaminaIdx].longitudRestante - corte.largo).toFixed(3)
        );
      } else {
        const nuevaLamina: LaminaComercialOptimizada = {
          id: `lamina-${laminasComerciales.length + 1}`,
          cortes: [corte],
          longitudRestante: parseFloat((largoComercial - corte.largo).toFixed(3))
        };
        laminasComerciales.push(nuevaLamina);
      }
    }

    // 3. Calculate Global Waste Percentage
    // Total material bought = number of commercial sheets * width * length
    const totalLaminas = laminasComerciales.length;
    const areaCompradaTotal = totalLaminas * largoComercial * anchoUtil;
    
    // Sum of areas of all rooms
    const areaNetaHabitaciones = espacios.reduce((sum, esp) => sum + (esp.largo * esp.ancho), 0);
    const desperdicioArea = areaCompradaTotal - areaNetaHabitaciones;
    const desperdicioGlobalPorcentaje = areaCompradaTotal > 0 
      ? parseFloat(Math.max(0, (desperdicioArea / areaCompradaTotal) * 100).toFixed(2)) 
      : 0;

    return {
      laminasComerciales,
      desgloseEspacios,
      totalLaminas,
      desperdicioGlobalPorcentaje
    };
  }
};
