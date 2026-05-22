import { useState, useEffect, useRef } from 'react';

export interface TelemetryLog {
  timestamp: string;
  source: string;
  message: string;
  data?: any;
}

export function useTelemetry(url = 'ws://localhost:8080') {
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLogs((prev) => [...prev, parsed].slice(-100)); // Keep last 100
        } catch (e) {
          console.error('Failed to parse telemetry', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url]);

  return { logs, connected };
}
