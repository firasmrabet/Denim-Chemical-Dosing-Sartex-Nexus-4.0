import { useEffect, useState } from "react";
import { simulator, type DoseEvent, type Mode } from "./simulator";

export function useSimulator() {
  const [history, setHistory] = useState<DoseEvent[]>([]);
  const [latest, setLatest] = useState<DoseEvent | null>(null);
  const [mode, setModeState] = useState<Mode>("simulation");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    simulator.init();
    setHistory([...simulator.getHistory()]);
    setMode(simulator.getMode());
    setReady(true);
    const unsub = simulator.subscribe((h, l) => {
      setHistory([...h]);
      if (l) setLatest(l);
      setModeState(simulator.getMode());
    });
    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setMode(m: Mode) {
    simulator.setMode(m);
    setModeState(m);
  }

  return { history, latest, mode, setMode, ready };
}
