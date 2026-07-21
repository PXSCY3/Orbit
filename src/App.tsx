import { useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import "./App.css";

import Toolbar from "./components/Toolbar";
import FileExplorer from "./components/FileExplorer";
import Terminal from "./components/Terminal";


function App() {

  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [showHidden, setShowHidden] = useState(false);


  function startResize(e: ReactMouseEvent) {
    e.preventDefault();

    // disable text selection while resizing and show proper cursor
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const resize = (ev: MouseEvent) => {
      const newWidth = ev.clientX;
      if (newWidth >= 450 && newWidth <= 900) {
        setSidebarWidth(newWidth);
      }
    };

    const stopResize = () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResize);
      // restore body styles
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
    };

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResize);
  }



  return (
    <main className="app">

      <Toolbar
        showHidden={showHidden}
        onToggleHidden={() => setShowHidden(prev => !prev)}
      />


      <section className="workspace">


        <aside
          className="sidebar"
          style={{
            width: sidebarWidth
          }}
        >

          <FileExplorer showHidden={showHidden} />

        </aside>


        <div
          className="resize-handle"
          onMouseDown={startResize}
        />


        <section className="terminal-panel">

          <Terminal />

        </section>


      </section>


    </main>
  );
}


export default App;