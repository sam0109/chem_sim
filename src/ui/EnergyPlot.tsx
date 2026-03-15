// ==============================================================
// EnergyPlot — real-time energy vs step chart using canvas
// ==============================================================

import React, { useRef, useEffect } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { useUIStore } from '../store/uiStore';

const WIDTH = 320;
const HEIGHT = 180;
const MARGIN = { top: 20, right: 10, bottom: 25, left: 50 };

export const EnergyPlot: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showEnergyPlot = useUIStore((s) => s.showEnergyPlot);
  const energyHistory = useSimulationStore((s) => s.energyHistory);

  useEffect(() => {
    if (!showEnergyPlot) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = energyHistory;
    const w = WIDTH - MARGIN.left - MARGIN.right;
    const h = HEIGHT - MARGIN.top - MARGIN.bottom;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background
    ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (data.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Run simulation to see energy plot', WIDTH / 2, HEIGHT / 2);
      return;
    }

    // Compute ranges
    let minE = Infinity, maxE = -Infinity;
    for (const d of data) {
      minE = Math.min(minE, d.kinetic, d.potential, d.total);
      maxE = Math.max(maxE, d.kinetic, d.potential, d.total);
    }
    const eRange = maxE - minE || 1;
    const minStep = data[0].step;
    const maxStep = data[data.length - 1].step;
    const stepRange = maxStep - minStep || 1;

    const toX = (step: number) => MARGIN.left + ((step - minStep) / stepRange) * w;
    const toY = (e: number) => MARGIN.top + h - ((e - minE) / eRange) * h;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = MARGIN.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(MARGIN.left + w, y);
      ctx.stroke();
    }

    // Draw lines
    const drawLine = (key: 'kinetic' | 'potential' | 'total', color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = toX(data[i].step);
        const y = toY(data[i][key]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine('kinetic', '#ff6666');
    drawLine('potential', '#6688ff');
    drawLine('total', '#66ff66');

    // Axes labels
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(maxE.toFixed(2), MARGIN.left - 4, MARGIN.top + 10);
    ctx.fillText(minE.toFixed(2), MARGIN.left - 4, MARGIN.top + h);

    ctx.textAlign = 'center';
    ctx.fillText('Step', WIDTH / 2, HEIGHT - 4);
    ctx.fillText(String(minStep), MARGIN.left, HEIGHT - 10);
    ctx.textAlign = 'right';
    ctx.fillText(String(maxStep), WIDTH - MARGIN.right, HEIGHT - 10);

    // Legend
    const legend = [
      { label: 'KE', color: '#ff6666' },
      { label: 'PE', color: '#6688ff' },
      { label: 'Total', color: '#66ff66' },
    ];
    ctx.font = '9px monospace';
    legend.forEach((l, i) => {
      const x = MARGIN.left + i * 55;
      ctx.fillStyle = l.color;
      ctx.fillRect(x, 4, 12, 8);
      ctx.fillStyle = '#ccc';
      ctx.textAlign = 'left';
      ctx.fillText(l.label, x + 16, 12);
    });
  }, [showEnergyPlot, energyHistory]);

  if (!showEnergyPlot) return null;

  return (
    <div data-testid="energy-plot" style={{
      position: 'absolute',
      bottom: 10,
      right: 10,
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
      zIndex: 100,
    }}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
    </div>
  );
};
