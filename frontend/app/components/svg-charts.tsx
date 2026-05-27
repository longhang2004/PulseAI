'use client';

import React from 'react';

interface LatencyPoint {
  bucket: string;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
}

interface ErrorPoint {
  bucket: string;
  errorCount: number;
  totalCount: number;
  errorRate: number;
}

export function LatencyChart({ data }: { data: LatencyPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
        No latency signals recorded in this window
      </div>
    );
  }

  const padding = 40;
  const chartHeight = 220;
  const chartWidth = 500;
  
  // Find max value to scale chart
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.avgLatency, d.p95Latency, d.p99Latency)),
    10 // minimum scale limit
  ) * 1.1;

  const pointsCount = data.length;
  
  const getX = (index: number) => {
    if (pointsCount <= 1) return padding;
    return padding + (index / (pointsCount - 1)) * (chartWidth - padding * 2);
  };

  const getY = (value: number) => {
    return chartHeight - padding - (value / maxVal) * (chartHeight - padding * 2);
  };

  // Build SVG Paths
  const buildPath = (key: 'avgLatency' | 'p95Latency' | 'p99Latency') => {
    return data.reduce((acc, current, index) => {
      const x = getX(index);
      const y = getY(current[key]);
      return acc + `${index === 0 ? 'M' : 'L'} ${x} ${y} `;
    }, '');
  };

  const avgPath = buildPath('avgLatency');
  const p95Path = buildPath('p95Latency');

  // Build Area Path for Avg Latency
  const avgAreaPath = avgPath 
    ? `${avgPath} L ${getX(pointsCount - 1)} ${chartHeight - padding} L ${getX(0)} ${chartHeight - padding} Z`
    : '';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Latency Profile</h3>
          <p className="text-xs text-zinc-500">P50 Average & P95 Percentiles (ms)</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400"></span> P50 Avg
          </span>
          <span className="flex items-center gap-1.5 text-amber-500">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span> P95 Max
          </span>
        </div>
      </div>
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = getY(maxVal * ratio);
            const val = Math.round(maxVal * ratio);
            return (
              <g key={i} className="opacity-20">
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#52525b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding - 8}
                  y={y + 4}
                  fill="#a1a1aa"
                  fontSize="9"
                  textAnchor="end"
                >
                  {val}ms
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {avgAreaPath && <path d={avgAreaPath} fill="url(#latencyGrad)" />}

          {/* Line paths */}
          {avgPath && (
            <path
              d={avgPath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {p95Path && (
            <path
              d={p95Path}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 3"
            />
          )}

          {/* Data Points */}
          {data.map((d, index) => {
            const x = getX(index);
            const y = getY(d.avgLatency);
            return (
              <g key={index} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-zinc-950 stroke-cyan-400 stroke-[2] transition-all group-hover:r-[5.5]"
                />
                <title>{`Avg: ${Math.round(d.avgLatency)}ms\nP95: ${Math.round(d.p95Latency)}ms\nTime: ${new Date(d.bucket).toLocaleTimeString()}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function ErrorRateChart({ data }: { data: ErrorPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
        No error signals recorded in this window
      </div>
    );
  }

  const padding = 40;
  const chartHeight = 220;
  const chartWidth = 500;

  // Find max rate to scale
  const maxRate = Math.max(...data.map((d) => d.errorRate), 5) * 1.1;
  const pointsCount = data.length;

  const getX = (index: number) => {
    if (pointsCount <= 1) return padding;
    return padding + (index / (pointsCount - 1)) * (chartWidth - padding * 2);
  };

  const getY = (value: number) => {
    return chartHeight - padding - (value / maxRate) * (chartHeight - padding * 2);
  };

  const buildPath = () => {
    return data.reduce((acc, current, index) => {
      const x = getX(index);
      const y = getY(current.errorRate);
      return acc + `${index === 0 ? 'M' : 'L'} ${x} ${y} `;
    }, '');
  };

  const linePath = buildPath();
  const areaPath = linePath
    ? `${linePath} L ${getX(pointsCount - 1)} ${chartHeight - padding} L ${getX(0)} ${chartHeight - padding} Z`
    : '';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Error Frequency</h3>
          <p className="text-xs text-zinc-500">Signal Error Rate Percentage (%)</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500"></span> Error %
          </span>
        </div>
      </div>
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = getY(maxRate * ratio);
            const val = (maxRate * ratio).toFixed(1);
            return (
              <g key={i} className="opacity-20">
                <line
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke="#52525b"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding - 8}
                  y={y + 4}
                  fill="#a1a1aa"
                  fontSize="9"
                  textAnchor="end"
                >
                  {val}%
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#errorGrad)" />}

          {/* Line Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {data.map((d, index) => {
            const x = getX(index);
            const y = getY(d.errorRate);
            return (
              <g key={index} className="group cursor-pointer">
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  className="fill-zinc-950 stroke-red-500 stroke-[2] transition-all group-hover:r-[5.5]"
                />
                <title>{`Error Rate: ${d.errorRate.toFixed(2)}%\nErrors: ${d.errorCount} / Total: ${d.totalCount}\nTime: ${new Date(d.bucket).toLocaleTimeString()}`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
