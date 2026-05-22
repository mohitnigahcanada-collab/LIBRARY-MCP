import React from 'react';
import { useTelemetry } from '../useTelemetry';

export function TelemetryFeed() {
  const { logs, connected } = useTelemetry();

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '900px' }}>
      <h1 style={{ marginBottom: '8px' }}>
        <span className="gradient-text">Live Telemetry</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
        Real-time thought stream from the BuilderBrain Multi-Agent OS.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{ 
          width: 8, height: 8, borderRadius: '50%', 
          background: connected ? 'var(--accent-green)' : 'var(--accent-red)',
          boxShadow: connected ? '0 0 10px var(--accent-green)' : 'none'
        }} />
        <span style={{ fontSize: 14, fontWeight: 500, color: connected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          {connected ? 'WebSocket Connected (Port 8080)' : 'Disconnected (Retrying...)'}
        </span>
      </div>

      <div className="telemetry-container glass-panel">
        {logs.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Waiting for agent thoughts...</div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="telemetry-line">
            <span className="telemetry-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className="telemetry-source">[{log.source}]</span>
            <span className="telemetry-msg">{log.message}</span>
            {log.data && (
              <pre style={{ color: 'var(--text-muted)', marginTop: 4, marginLeft: 16 }}>
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
