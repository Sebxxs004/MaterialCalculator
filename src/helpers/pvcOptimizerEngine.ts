import type { Espacio, PVCConfig, ResultadoConsolidado, CorteOptimo, LaminaComercialOptimizada, DesgloseEspacio } from '../types/material';
import polygonClipping from 'polygon-clipping';

// Helper to obtain vertices from any room shape
export function obtenerVerticesDeEspacio(espacio: Espacio): { x: number; y: number }[] {
  const { largo, ancho, tipo, vertices, largoA, anchoA } = espacio;
  
  if (tipo === 'polygon' && vertices && vertices.length >= 3) {
    return vertices;
  }
  
  if (tipo === 'l_shape') {
    const w = ancho;
    const l = largo;
    const la = largoA !== undefined ? largoA : l * 0.6;
    const wa = anchoA !== undefined ? anchoA : w * 0.6;

    // Standard 6-vertices L-shape geometry
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: la },
      { x: wa, y: la },
      { x: wa, y: l },
      { x: 0, y: l }
    ];
  }

  if (tipo === 'mocheta') {
    const wSup = espacio.anchoSup !== undefined ? espacio.anchoSup : 2.50;
    const lIzq = espacio.largoIzq !== undefined ? espacio.largoIzq : 2.60;
    const wInf = espacio.anchoInf !== undefined ? espacio.anchoInf : 1.70;
    const dQ = espacio.profQuiebre !== undefined ? espacio.profQuiebre : 0.40;
    const pos = espacio.posQuiebre || 'inf_der';

    if (pos === 'inf_der') {
      return [
        { x: 0, y: 0 },
        { x: wSup, y: 0 },
        { x: wSup, y: lIzq - dQ },
        { x: wInf, y: lIzq - dQ },
        { x: wInf, y: lIzq },
        { x: 0, y: lIzq }
      ];
    } else if (pos === 'inf_izq') {
      const cutoutW = wSup - wInf;
      return [
        { x: 0, y: 0 },
        { x: wSup, y: 0 },
        { x: wSup, y: lIzq },
        { x: cutoutW, y: lIzq },
        { x: cutoutW, y: lIzq - dQ },
        { x: 0, y: lIzq - dQ }
      ];
    } else if (pos === 'sup_der') {
      return [
        { x: 0, y: 0 },
        { x: wInf, y: 0 },
        { x: wInf, y: dQ },
        { x: wSup, y: dQ },
        { x: wSup, y: lIzq },
        { x: 0, y: lIzq }
      ];
    } else { // 'sup_izq'
      const cutoutW = wSup - wInf;
      return [
        { x: cutoutW, y: 0 },
        { x: wSup, y: 0 },
        { x: wSup, y: lIzq },
        { x: 0, y: lIzq },
        { x: 0, y: dQ },
        { x: cutoutW, y: dQ }
      ];
    }
  }
  
  // Default rectangular
  return [
    { x: 0, y: 0 },
    { x: ancho, y: 0 },
    { x: ancho, y: largo },
    { x: 0, y: largo }
  ];
}

// Helper to calculate polygon area using Shoelace formula
export function calcularAreaPoligono(vertices: { x: number; y: number }[]): number {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
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

// Divide a cut into commercial sheets if it exceeds the maximum commercial length
interface SubdivisionCorte {
  largo: number;
  poligono: [number, number][][];
}

function subdividirCorte(
  verticesOriginal: [number, number][],
  minVal: number,
  maxVal: number,
  largoComercial: number,
  esLargo: boolean
): SubdivisionCorte[] {
  const totalLargo = maxVal - minVal;
  if (totalLargo <= largoComercial) {
    return [{ largo: parseFloat(totalLargo.toFixed(3)), poligono: [verticesOriginal] }];
  }

  const result: SubdivisionCorte[] = [];
  let currentStart = minVal;

  while (currentStart < maxVal) {
    const currentEnd = Math.min(currentStart + largoComercial, maxVal);
    const length = parseFloat((currentEnd - currentStart).toFixed(3));

    // Clip the original piece geometry with a bounding split rectangle
    let splitBox: any;
    if (esLargo) {
      splitBox = [
        [
          [ -1000, currentStart ],
          [ 1000, currentStart ],
          [ 1000, currentEnd ],
          [ -1000, currentEnd ],
          [ -1000, currentStart ]
        ]
      ];
    } else {
      splitBox = [
        [
          [ currentStart, -1000 ],
          [ currentEnd, -1000 ],
          [ currentEnd, 1000 ],
          [ currentStart, 1000 ],
          [ currentStart, -1000 ]
        ]
      ];
    }

    const intersection = polygonClipping.intersection([verticesOriginal], splitBox);
    if (intersection && intersection.length > 0) {
      // Collect the largest polygon part from intersection
      intersection.forEach((poly) => {
        poly.forEach((ring) => {
          if (ring.length >= 3) {
            result.push({
              largo: length,
              poligono: [ring as [number, number][]]
            });
          }
        });
      });
    } else {
      // Fallback if geometry clipping fails
      result.push({ largo: length, poligono: [verticesOriginal] });
    }

    currentStart = currentEnd;
  }

  return result;
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

    // 1. Process each space
    for (const espacio of espacios) {
      const vertices = obtenerVerticesDeEspacio(espacio);
      
      // Calculate bounding box of the polygon
      const xs = vertices.map(v => v.x);
      const ys = vertices.map(v => v.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const boundsWidth = maxX - minX;
      const boundsLength = maxY - minY;

      // Close polygon ring for polygon-clipping
      const roomCoords: [number, number][] = vertices.map(v => [v.x, v.y]);
      roomCoords.push([vertices[0].x, vertices[0].y]);
      const roomPoly: any = [roomCoords];

      // --- EVALUATE LARGO DIRECTION (vertical strips aligned along X-axis) ---
      const hilerasLargo = Math.ceil(boundsWidth / anchoUtil);
      const todosCortesLargo: number[] = [];
      const cortesDetalleLargo: { largo: number; poligono: [number, number][][]; hilera: number }[] = [];

      for (let h = 0; h < hilerasLargo; h++) {
        const xStart = minX + h * anchoUtil;
        const xEnd = minX + (h + 1) * anchoUtil;

        // Strip box
        const stripPoly: any = [
          [
            [ xStart, minY - 10 ],
            [ xEnd, minY - 10 ],
            [ xEnd, maxY + 10 ],
            [ xStart, maxY + 10 ],
            [ xStart, minY - 10 ]
          ]
        ];

        const intersect = polygonClipping.intersection(roomPoly, stripPoly);
        if (intersect && intersect.length > 0) {
          intersect.forEach((poly) => {
            poly.forEach((ring) => {
              if (ring.length >= 3) {
                const ringYs = ring.map(pt => pt[1]);
                const yMinPiece = Math.min(...ringYs);
                const yMaxPiece = Math.max(...ringYs);
                const pieceLength = yMaxPiece - yMinPiece;

                if (pieceLength > 0.02) {
                  // Subdivide if longer than commercial sheet
                  const subdivided = subdividirCorte(ring as [number, number][], yMinPiece, yMaxPiece, largoComercial, true);
                  subdivided.forEach((sub) => {
                    todosCortesLargo.push(sub.largo);
                    cortesDetalleLargo.push({
                      largo: sub.largo,
                      poligono: sub.poligono,
                      hilera: h
                    });
                  });
                }
              }
            });
          });
        }
      }
      const laminasNecesariasLargo = simularBinPacking(todosCortesLargo, largoComercial);

      // --- EVALUATE ANCHO DIRECTION (horizontal strips aligned along Y-axis) ---
      const hilerasAncho = Math.ceil(boundsLength / anchoUtil);
      const todosCortesAncho: number[] = [];
      const cortesDetalleAncho: { largo: number; poligono: [number, number][][]; hilera: number }[] = [];

      for (let h = 0; h < hilerasAncho; h++) {
        const yStart = minY + h * anchoUtil;
        const yEnd = minY + (h + 1) * anchoUtil;

        // Strip box
        const stripPoly: any = [
          [
            [ minX - 10, yStart ],
            [ maxX + 10, yStart ],
            [ maxX + 10, yEnd ],
            [ minX - 10, yEnd ],
            [ minX - 10, yStart ]
          ]
        ];

        const intersect = polygonClipping.intersection(roomPoly, stripPoly);
        if (intersect && intersect.length > 0) {
          intersect.forEach((poly) => {
            poly.forEach((ring) => {
              if (ring.length >= 3) {
                const ringXs = ring.map(pt => pt[0]);
                const xMinPiece = Math.min(...ringXs);
                const xMaxPiece = Math.max(...ringXs);
                const pieceLength = xMaxPiece - xMinPiece;

                if (pieceLength > 0.02) {
                  // Subdivide if longer than commercial sheet
                  const subdivided = subdividirCorte(ring as [number, number][], xMinPiece, xMaxPiece, largoComercial, false);
                  subdivided.forEach((sub) => {
                    todosCortesAncho.push(sub.largo);
                    cortesDetalleAncho.push({
                      largo: sub.largo,
                      poligono: sub.poligono,
                      hilera: h
                    });
                  });
                }
              }
            });
          });
        }
      }
      const laminasNecesariasAncho = simularBinPacking(todosCortesAncho, largoComercial);

      // --- CHOOSE OPTIMAL DIRECTION ---
      let orientacionElegida: 'largo' | 'ancho';
      if (espacio.orientacionSeleccionada === 'auto') {
        orientacionElegida = laminasNecesariasLargo <= laminasNecesariasAncho ? 'largo' : 'ancho';
      } else {
        orientacionElegida = espacio.orientacionSeleccionada;
      }

      const hilerasRequeridas = orientacionElegida === 'largo' ? hilerasLargo : hilerasAncho;
      const cortesFinales = orientacionElegida === 'largo' ? cortesDetalleLargo : cortesDetalleAncho;

      const cortesRequeridos: number[] = [];
      cortesFinales.forEach((item) => {
        cortesRequeridos.push(item.largo);
        todosLosCortesRequeridos.push({
          id: crypto.randomUUID(),
          largo: item.largo,
          espacioId: espacio.id,
          espacioNombre: espacio.nombre,
          hileraIndex: item.hilera,
          poligonoRecortado: item.poligono
        });
      });

      desgloseEspacios.push({
        espacioId: espacio.id,
        espacioNombre: espacio.nombre,
        orientacionElegida,
        hilerasRequeridas,
        cortesRequeridos
      });
    }

    // 2. Bin Packing (Best Fit Decreasing) on consolidated cuts
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
    const totalLaminas = laminasComerciales.length;
    const areaCompradaTotal = totalLaminas * largoComercial * anchoUtil;
    
    // Sum of exact net polygon areas of all rooms
    const areaNetaHabitaciones = espacios.reduce((sum, esp) => {
      const vertices = obtenerVerticesDeEspacio(esp);
      return sum + calcularAreaPoligono(vertices);
    }, 0);

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
