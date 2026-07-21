import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";

import "xterm/css/xterm.css";
import "./Terminal.css";


export default function Terminal() {

  type Tab = { id: string; title: string; sessionId?: string };

  const [tabs, setTabs] = useState<Tab[]>(() => [{ id: "tab-1", title: "bash" }]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  const terminalContainers = useRef(new Map<string, HTMLDivElement | null>());
  const terminals = useRef(new Map<string, { term: XTerm; fit: FitAddon }>());
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabSessions = useRef(new Map<string, string>()); // tabId -> sessionId
  const sessionToTab = useRef(new Map<string, string>()); // sessionId -> tabId
  const tabSessionsPending = useRef(new Set<string>());
  const lastSent = useRef(new Map<string, { data: string; ts: number }>());
  const abortControllers = useRef(new Map<string, AbortController>()); // tabId -> AbortController
  const defaultOptions = {
    cursorBlink: true,
    fontSize: 14,
    allowProposedApi: true,
    theme: {
      background: "#222",
      foreground: "#ffffff",
      black: "#000000",
      red: "#ff0000",
      green: "#00ff00",
      yellow: "#ffff00",
      blue: "#0000ff",
      magenta: "#ff00ff",
      cyan: "#00ffff",
      white: "#ffffff",
      brightBlack: "#808080",
      brightRed: "#ff6060",
      brightGreen: "#60ff60",
      brightYellow: "#ffff60",
      brightBlue: "#6060ff",
      brightMagenta: "#ff60ff",
      brightCyan: "#60ffff",
      brightWhite: "#ffffff",
    },
  } as const;

  useEffect(() => {

    // helper logic for creating terminals is handled in the tabs effect below

    const fitAll = () => {
      for (const { fit } of terminals.current.values()) {
        try {
          fit.fit();
        } catch {}
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      fitAll();
    });

    resizeObserver.observe(document.body);

    // Prevent duplicate listeners (React StrictMode/HMR). Listen for session-tagged outputs.
    let cleanup: (() => void) | undefined;
    if (!(window as any).__orbit_terminal_started__) {
      async function setup() {
        const unlisten = await listen<any>("terminal-output", (event) => {
          try {
            const payload = event.payload as { id: string; payload: string };
            const tabId = sessionToTab.current.get(payload.id);
            if (tabId) {
              const entry = terminals.current.get(tabId);
              if (entry) {
                try { entry.term.write(payload.payload); } catch {}
              }
            }
          } catch {}
        });

        (window as any).__orbit_terminal_started__ = true;

        return unlisten;
      }

      setup().then((fn) => {
        cleanup = fn as unknown as () => void;
      });
    }

    return () => {
      resizeObserver.disconnect();
      try { (window as any).__orbit_terminal_started__ = false; } catch {}
      if (cleanup) cleanup();
      for (const { term } of terminals.current.values()) {
        try { term.dispose(); } catch {}
      }
      // close sessions
      for (const session of tabSessions.current.values()) {
        try { invoke("close_terminal", { session }); } catch {}
      }
    };
  }, []);


  // initialize terminals for tabs when containers become available
  useEffect(() => {
    for (const tab of tabs) {
      if (!terminals.current.has(tab.id)) {
        const container = terminalContainers.current.get(tab.id);
        if (container) {
          // avoid creating a terminal if the container already has an xterm attached
          try {
            if (container.querySelector && container.querySelector('.xterm')) {
              terminals.current.set(tab.id, { term: (null as any), fit: (null as any) });
              continue;
            }
          } catch {}
          const term = new XTerm(defaultOptions as any);
          const fit = new FitAddon();
          term.loadAddon(fit);
          term.open(container);
          term.onData((data) => {
            const now = Date.now();
            const prev = lastSent.current.get(tab.id);
            if (prev && prev.data === data && now - prev.ts < 60) {
              return; // probable duplicate, ignore
            }
            lastSent.current.set(tab.id, { data, ts: now });
            const session = tabSessions.current.get(tab.id);
            if (session) {
              invoke("write_terminal", { session, input: data });
            }
          });
          try { fit.fit(); } catch {}
          terminals.current.set(tab.id, { term, fit });

          // ensure a backend session exists for this tab (avoid concurrent starts)
          // Cancel any previous pending session for this tab
          const existingAbort = abortControllers.current.get(tab.id);
          if (existingAbort) {
            existingAbort.abort();
          }

          const abortController = new AbortController();
          abortControllers.current.set(tab.id, abortController);

          (async () => {
            if (!tabSessions.current.get(tab.id) && !tabSessionsPending.current.has(tab.id)) {
              try {
                tabSessionsPending.current.add(tab.id);
                const session: string = await invoke<string>("start_terminal");
                // Check if this async was cancelled
                if (abortController.signal.aborted) {
                  // Clean up the session since we won't use it
                  try { invoke("close_terminal", { session }); } catch {}
                  return;
                }
                tabSessions.current.set(tab.id, session);
                sessionToTab.current.set(session, tab.id);
                setTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, sessionId: session } : t));
              } catch {} finally {
                tabSessionsPending.current.delete(tab.id);
              }
            }
          })();
        }
      }
    }

    // Cleanup: abort any pending session startups
    return () => {
      for (const [, abort] of abortControllers.current.entries()) {
        abort.abort();
      }
      abortControllers.current.clear();
    };
  }, [tabs]);



  return (
    <section className="terminal">


      <div className="terminalHeader">

        <div className="terminalTabs">
          {tabs.map((t) => (
            <div key={t.id} className={"tab" + (t.id === activeTabId ? " active" : "")} onClick={() => setActiveTabId(t.id)}>
              <span className="tab-title">{t.title}</span>
              <button
                className="tab-close"
                title="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  // close tab
                  setTabs((prev) => {
                    const next = prev.filter((p) => p.id !== t.id);
                    if (next.length === 0) {
                      return [{ id: "tab-1", title: "bash" }];
                    }
                    return next;
                  });
                  // remove terminal if exists
                  const existing = terminals.current.get(t.id);
                  if (existing) {
                    try { existing.term.dispose(); } catch {}
                    terminals.current.delete(t.id);
                  }
                  // cancel any pending session startup
                  const abort = abortControllers.current.get(t.id);
                  if (abort) {
                    abort.abort();
                    abortControllers.current.delete(t.id);
                  }
                  // close backend session
                  const session = tabSessions.current.get(t.id);
                  if (session) {
                    try { invoke("close_terminal", { session }); } catch {}
                    tabSessions.current.delete(t.id);
                    sessionToTab.current.delete(session);
                  }
                  // if closing active, pick another
                  setActiveTabId((current) => current === t.id ? (tabs.find(x=>x.id!==t.id)?.id ?? "tab-1") : current);
                }}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            className="tab add"
            onClick={() => {
              const id = `tab-${Date.now()}`;
              setTabs((prev) => [...prev, { id, title: "bash" }]);
              setActiveTabId(id);
              // start session will be created once container mounts (in tabs effect)
            }}
          >
            +
          </button>

        </div>

      </div>


      {tabs.map((t) => (
        <div
          key={t.id}
          className="terminalOutput"
          ref={(el) => { terminalContainers.current.set(t.id, el); }}
          style={{ display: t.id === activeTabId ? undefined : "none" }}
        />
      ))}

    </section>
  );
}