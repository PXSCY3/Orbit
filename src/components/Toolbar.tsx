import { useEffect, useRef, useState } from "react";

interface ToolbarProps {
  showHidden: boolean;
  onToggleHidden: () => void;
}

interface ToolbarMenuItem {
  label: string;
  action: () => void;
  toggle?: boolean;
}

interface ToolbarMenu {
  name: string;
  items: ToolbarMenuItem[];
}

const menuDefinitions: ToolbarMenu[] = [
  {
    name: "File",
    items: [
      { label: "New Window", action: () => console.log("New Window") },
      { label: "Open...", action: () => console.log("Open") },
      { label: "Save", action: () => console.log("Save") },
    ],
  },
];

export default function Toolbar({ showHidden, onToggleHidden }: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const viewMenu = {
    name: "View",
    items: [
      {
        label: showHidden ? "Hide hidden items" : "Show hidden items",
        action: onToggleHidden,
        toggle: true,
      },
      { label: "Refresh", action: () => console.log("Refresh") },
    ],
  };

  return (
    <div className="toolbar" ref={toolbarRef}>
      {[...menuDefinitions, viewMenu].map((menu) => (
        <div key={menu.name} className="toolbar-menu">
          <button
            className="toolbar-button toolbar-menu-button"
            onClick={() =>
              setOpenMenu((current) => (current === menu.name ? null : menu.name))
            }
            aria-expanded={openMenu === menu.name}
            aria-haspopup="menu"
          >
            {menu.name}
          </button>

          {openMenu === menu.name && (
            <div className="toolbar-dropdown" role="menu">
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  className="toolbar-dropdown-item"
                  onClick={() => {
                    item.action();
                    if (!item.toggle) {
                      setOpenMenu(null);
                    }
                  }}
                >
                  {item.toggle ? (
                    <span className="toolbar-dropdown-item-checkbox">
                      {showHidden ? "✓" : ""}
                    </span>
                  ) : null}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
