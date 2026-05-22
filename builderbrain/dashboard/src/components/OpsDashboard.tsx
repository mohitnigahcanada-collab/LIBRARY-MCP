import React, { useState } from 'react';
import { api } from '../api';

export function OpsDashboard() {
  const [task, setTask] = useState('');
  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [undoId, setUndoId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelegate = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const res = await api.delegate(task, ['Frontend Specialist', 'Backend Architect']);
      alert(`Delegated! Plan: ${JSON.stringify(res.orchestrationPlan, null, 2)}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleSnapshot = async () => {
    if (!snapshotMsg) return;
    setLoading(true);
    try {
      const res = await api.snapshot(snapshotMsg);
      alert(res.success ? `Snapshot created: ${res.snapshotId}` : `Error: ${res.message}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleUndo = async () => {
    if (!undoId) return;
    setLoading(true);
    try {
      const res = await api.undo(undoId);
      alert(res.success ? 'Reverted successfully!' : `Error: ${res.message}`);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1000px' }}>
      <h1 style={{ marginBottom: '8px' }}>
        <span className="gradient-text">Agentic Ops (V3)</span>
      </h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Trigger massive multi-agent workflows, manual snapshots, and time-travel undos.
      </p>

      <div className="ops-grid">
        <div className="ops-card glass-panel">
          <div className="ops-card-header">
            <span className="icon">🚀</span>
            Orchestrator
          </div>
          <p>Hire specialized sub-agents to execute parts of a massive task in parallel.</p>
          <input 
            className="glass-input" 
            placeholder="E.g., Build a full-stack Next.js app" 
            value={task} onChange={e => setTask(e.target.value)} 
          />
          <button className="glass-button primary" onClick={handleDelegate} disabled={loading}>
            Delegate Task
          </button>
        </div>

        <div className="ops-card glass-panel">
          <div className="ops-card-header">
            <span className="icon">📸</span>
            Git Snapshot
          </div>
          <p>Create a hidden background snapshot of the codebase before you let an agent rip.</p>
          <input 
            className="glass-input" 
            placeholder="Snapshot reason (e.g., pre-refactor)" 
            value={snapshotMsg} onChange={e => setSnapshotMsg(e.target.value)} 
          />
          <button className="glass-button primary" onClick={handleSnapshot} disabled={loading}>
            Create Snapshot
          </button>
        </div>

        <div className="ops-card glass-panel">
          <div className="ops-card-header">
            <span className="icon">⏪</span>
            Time-Travel Undo
          </div>
          <p>Did an agent hallucinate and break everything? Roll it back instantly.</p>
          <input 
            className="glass-input" 
            placeholder="Snapshot ID (e.g., 5b2a9d8)" 
            value={undoId} onChange={e => setUndoId(e.target.value)} 
          />
          <button className="glass-button primary" onClick={handleUndo} disabled={loading}>
            Undo to Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}
