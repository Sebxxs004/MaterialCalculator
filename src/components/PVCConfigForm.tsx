import React from 'react';
import type { PVCConfig } from '../types/material';
import { Settings, Ruler, Maximize2, DollarSign } from 'lucide-react';

interface PVCConfigFormProps {
  config: PVCConfig;
  onChange: (newConfig: PVCConfig) => void;
}

export const PVCConfigForm: React.FC<PVCConfigFormProps> = ({ config, onChange }) => {
  const handleNumberChange = (field: keyof PVCConfig, value: string) => {
    const numValue = parseFloat(value);
    onChange({
      ...config,
      [field]: isNaN(numValue) ? 0 : numValue,
    });
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl transition-all-custom hover:shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
          <Settings className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Configuración de la Lámina</h2>
          <p className="text-xs text-slate-400">Define las dimensiones estándar del PVC</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Largo Comercial */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Ruler className="w-4 h-4 text-indigo-400" />
            Largo Comercial (m)
          </label>
          <div className="relative rounded-xl shadow-sm">
            <input
              type="number"
              step="0.01"
              min="0.1"
              value={config.largoComercial || ''}
              onChange={(e) => handleNumberChange('largoComercial', e.target.value)}
              className="block w-full rounded-xl border-slate-700 bg-slate-900/60 pl-4 pr-12 py-3 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border transition-all-custom focus:outline-none"
              placeholder="Ej. 5.95"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <span className="text-xs font-semibold text-slate-400">m</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">Longitud estándar del listón comercial de PVC.</p>
        </div>

        {/* Ancho Útil */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-indigo-400" />
            Ancho Útil (m)
          </label>
          <div className="relative rounded-xl shadow-sm">
            <input
              type="number"
              step="0.01"
              min="0.05"
              value={config.anchoUtil || ''}
              onChange={(e) => handleNumberChange('anchoUtil', e.target.value)}
              className="block w-full rounded-xl border-slate-700 bg-slate-900/60 pl-4 pr-12 py-3 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border transition-all-custom focus:outline-none"
              placeholder="Ej. 0.25"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <span className="text-xs font-semibold text-slate-400">m</span>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">Ancho expuesto de la lámina después de encajar.</p>
        </div>

        {/* Precio por Lámina */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-400" />
            Precio por Lámina
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <span className="text-sm text-slate-500">$</span>
            </div>
            <input
              type="number"
              min="0"
              value={config.precioPorLamina || ''}
              onChange={(e) => handleNumberChange('precioPorLamina', e.target.value)}
              className="block w-full rounded-xl border-slate-700 bg-slate-900/60 pl-8 pr-4 py-3 text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border transition-all-custom focus:outline-none"
              placeholder="Ej. 25000"
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Costo unitario por lámina para calcular presupuesto.</p>
        </div>
      </div>
    </div>
  );
};
