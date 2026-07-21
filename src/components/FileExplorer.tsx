import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./FileExplorer.css";

const QUICK_ACCESS_STORAGE_KEY = "orbitApp.quickAccess";

interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  children?: FileEntry[];
  expanded?: boolean;
  loaded?: boolean;
}

interface SearchResult {
  name: string;
  path: string;
  is_directory: boolean;
}

interface QuickAccessEntry {
  name: string;
  path: string;
}

async function loadDirectory(path: string) {
  return await invoke<FileEntry[]>("read_directory", { path });
}

function TreeNode({
  node,
  onToggle,
  onOpenEntry,
  onAddQuickAccess,
  onContextMenu
}: {
  node: FileEntry;
  onToggle: (node: FileEntry) => void;
  onOpenEntry: (node: FileEntry) => void;
  onAddQuickAccess: (node: FileEntry) => void;
  onContextMenu: (node: FileEntry, e: React.MouseEvent) => void;
}) {
  return (
    <div className="tree-node">
      <div className="tree-item" onContextMenu={(e) => onContextMenu(node, e)}>

        <div
          className="tree-name"
          onClick={() => node.is_directory && onToggle(node)}
        >
          <span className="icon">
            {node.is_directory
              ? node.expanded ? "📂" : "📁"
              : "📄"}
          </span>

          <div className="tree-name-wrap">
            <span className="tree-name-text">{node.name}</span>
            <span className="tree-path">{node.path}</span>
          </div>
        </div>

        <button
          className="action-btn"
          onClick={() => onAddQuickAccess(node)}
          title="Add to Quick Access"
        >
          Favorite
        </button>

        <button
          className="action-btn"
          onClick={() => onOpenEntry(node)}
          title={
            node.is_directory
              ? "Open folder in terminal"
              : "View file contents"
          }
        >
          {node.is_directory ? "⌘" : "📄"}
        </button>

      </div>

      {node.expanded && node.children && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              onToggle={onToggle}
              onOpenEntry={onOpenEntry}
              onAddQuickAccess={onAddQuickAccess}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({ showHidden }: { showHidden: boolean }) {

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [homePath, setHomePath] = useState<string>("/home");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<FileEntry[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessEntry[]>(() => {
    try {
      const stored = localStorage.getItem(QUICK_ACCESS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSearching, setIsSearching] = useState(false);

  // Context menu state
  interface MenuItem {
    label: string;
    action?: (node: FileEntry) => void;
  }

  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; node?: FileEntry; items?: MenuItem[] }>({
    visible: false,
    x: 0,
    y: 0,
  });

  // default menu items - edit or extend these where marked
  function defaultContextMenuItems(): MenuItem[] {
    return [
      {
        label: "Open in Terminal",
        action: (n) => {
          // default action: open in terminal (folders) or cat file
          openInTerminal(n);
        },
      },
      {
        label: "Open in VS Code",
        action: (n) => {
          openInCode(n);
        },
      },
      // add more items here
    ];
  }

  // show context menu at mouse position
  function showContextMenu(node: FileEntry, e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, node, items: defaultContextMenuItems() });
  }

  useEffect(() => {
    function onAnyClick() {
      if (contextMenu.visible) {
        setContextMenu((s) => ({ ...s, visible: false }));
      }
    }

    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu((s) => ({ ...s, visible: false }));
      }
    }

    window.addEventListener("click", onAnyClick);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", onAnyClick);
      window.removeEventListener("keydown", onEsc);
    };
  }, [contextMenu.visible]);

  function isHiddenEntry(entry: { name: string }) {
    return entry.name.startsWith(".");
  }

  function filterHiddenEntries(entries: FileEntry[]) {
    return showHidden ? entries : entries.filter(entry => !isHiddenEntry(entry));
  }

  useEffect(() => {
    try {
      localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(quickAccess));
    } catch {
      // ignore storage failures
    }
  }, [quickAccess]);

  const searchTimeout = useRef<number | null>(null);
  const latestQuery = useRef("");

  async function openInTerminal(entry: FileEntry) {

    const command = entry.is_directory
      ? `cd "${entry.path}"\n`
      : `cat "${entry.path}"\n`;

    await invoke("write_terminal", {
      input: command
    });
  }

  async function openInCode(entry: FileEntry) {
    try {
      await invoke("open_in_vscode", { path: entry.path });
    } catch (error) {
      console.error("Failed to open in VS Code:", error);
    }
  }

  useEffect(() => {

    async function init() {
      try {
        const home = await invoke<string>("get_home_directory");
        setHomePath(home);

        const entries = await loadDirectory(home);

        setFiles(
          entries.map(file => ({
            ...file,
            expanded: false,
            loaded: false
          }))
        );

      } catch(error) {
        console.error(
          "Failed loading filesystem:",
          error
        );
      }
    }

    init();

  }, []);

  async function toggleFolder(folder: FileEntry) {

    if (!folder.is_directory)
      return;

    if (!folder.loaded) {

      const children = await loadDirectory(folder.path);

      folder.children = children.map(child => ({
        ...child,
        expanded: false,
        loaded: false
      }));

      folder.loaded = true;
    }

    folder.expanded = !folder.expanded;

    setFiles([...files]);
  }

  async function toggleSearchFolder(folder: FileEntry) {
    if (!folder.is_directory) return;

    if (!folder.loaded) {
      const children = await loadDirectory(folder.path);
      folder.children = children.map(child => ({
        ...child,
        expanded: false,
        loaded: false
      }));
      folder.loaded = true;
    }

    folder.expanded = !folder.expanded;
    setSearchResults([...searchResults]);
  }

  function addQuickAccess(entry: FileEntry) {
    setQuickAccess(prev => {
      if (prev.some(item => item.path === entry.path)) {
        return prev;
      }
      const next = [...prev, { name: entry.name, path: entry.path }];
      try {
        localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors silently
      }
      return next;
    });
  }

  function openQuickAccess(entry: QuickAccessEntry) {
    loadAndShowDirectory(entry.path);
  }

  function removeQuickAccess(path: string) {
    setQuickAccess(prev => prev.filter(item => item.path !== path));
  }

  async function loadAndShowDirectory(path: string) {
    setSearch("");
    setSearchResults([]);

    try {
      const entries = await loadDirectory(path);
      setFiles(
        entries.map(file => ({
          ...file,
          expanded: false,
          loaded: false
        }))
      );
    } catch (error) {
      console.error("Failed loading directory:", path, error);
    }
  }

  async function goHome() {
    await loadAndShowDirectory(homePath);
  }

  async function goDocuments() {
    await loadAndShowDirectory(`${homePath}/Documents`);
  }

  async function goDownloads() {
    await loadAndShowDirectory(`${homePath}/Downloads`);
  }

  function getPathDepth(path: string) {
    return path.split("/").filter(Boolean).length;
  }

  function normalizeSearchResults(results: SearchResult[]): FileEntry[] {
    return results
      .map(result => ({
        ...result,
        expanded: false,
        loaded: false,
      }))
      .sort((a, b) => {
        if (a.is_directory !== b.is_directory) {
          return a.is_directory ? -1 : 1;
        }

        const aDepth = getPathDepth(a.path);
        const bDepth = getPathDepth(b.path);
        if (aDepth !== bDepth) {
          return aDepth - bDepth;
        }

        return a.name.localeCompare(b.name);
      });
  }

  function searchMachine(value: string) {
    const trimmed = value.trim();

    setSearch(value);
    latestQuery.current = trimmed;

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (trimmed.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    searchTimeout.current = window.setTimeout(async () => {
      const query = trimmed;

      try {
        const results = await invoke<SearchResult[]>(
          "search_files",
          {
            root: homePath,
            query
          }
        );

        if (latestQuery.current !== query) {
          return;
        }

        setSearchResults(normalizeSearchResults(results));
      } catch(error) {
        console.error(
          "Search failed",
          error
        );
      } finally {
        if (latestQuery.current === query) {
          setIsSearching(false);
        }
      }
    }, 500);
  }

  return (
    <aside className="fileExplorer">

      <div className="explorerHeader">
        <h3>Explorer</h3>
      </div>

      <div className="searchContainer">
        <input
          type="text"
          placeholder="Search"
          value={search}
          onChange={(e) => searchMachine(e.target.value)}
        />
      </div>

      <div className="quickAccess">

        <h4>Quick Access</h4>

        <button onClick={goHome}>🏠 Home</button>
        <button onClick={goDocuments}>📁 Documents</button>
        <button onClick={goDownloads}>⬇️ Downloads</button>

        {quickAccess.length > 0 && (
          <>
            <h4>Favorites</h4>
            {quickAccess.map(entry => (
              <div key={entry.path} className="favoriteEntry">
                <button className="favoriteEntryMain" onClick={() => openQuickAccess(entry)}>
                  ⭐ {entry.name}
                </button>
                <button
                  className="action-btn favoriteEntryRemove"
                  onClick={() => removeQuickAccess(entry.path)}
                  title="Remove favorite"
                >
                  ✕
                </button>
              </div>
            ))}
          </>
        )}

      </div>

      <div className="tree">

        {search.length > 0
          ? (
            <>
              {isSearching && <div className="searchingStatus">Searching...</div>}
              {search.length < 3 && !isSearching && (
                <div className="searchingStatus">
                  Type at least 3 characters to search.
                </div>
              )}
              {filterHiddenEntries(searchResults).map(file => (
                <TreeNode
                  key={file.path}
                  node={file}
                  onToggle={toggleSearchFolder}
                  onOpenEntry={openInTerminal}
                  onAddQuickAccess={addQuickAccess}
                  onContextMenu={showContextMenu}
                />
              ))}
            </>
          )
              : filterHiddenEntries(files).map(file => (
              <TreeNode
                key={file.path}
                node={file}
                onToggle={toggleFolder}
                onOpenEntry={openInTerminal}
                onAddQuickAccess={addQuickAccess}
                onContextMenu={showContextMenu}
              />
            ))
        }

      </div>

      {contextMenu.visible && contextMenu.node && (
        <div
          className="contextMenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.items?.map(item => (
            <button
              key={item.label}
              className="contextMenuItem"
              onClick={(e) => {
                e.stopPropagation();
                if (item.action && contextMenu.node) item.action(contextMenu.node);
                setContextMenu((s) => ({ ...s, visible: false }));
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

    </aside>
  );
}
