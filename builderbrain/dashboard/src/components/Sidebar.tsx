import React from 'react';

export type Mode = 'telemetry' | 'ops' | 'discover';

export function Sidebar({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const modes: Array<{ id: Mode; icon: string; label: string }> = [
    { id: 'telemetry', icon: '📡', label: 'Live Telemetry' },
    { id: 'ops', icon: '⚡', label: 'Agent Ops (V3)' },
    { id: 'discover', icon: '🌟', label: 'Discover' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <span className="icon">🧠</span>
        <div>
          <div>BuilderBrain</div>
          <div style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600 }}>v3.0.0 OS</div>
        </div>
      </div>

      <div className="sidebar-section">
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>
          Command Center
        </div>
        {modes.map((m) => (
          <div
            key={m.id}
            className={`nav-item ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            <span className="icon">{m.icon}</span>
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}
