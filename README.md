# Orbit

Orbit is a Tauri desktop application built with React and TypeScript.

<img width="1920" height="1040" alt="orbit-screenshot" src="https://github.com/user-attachments/assets/c3d86db7-a564-4c4f-b7f0-113b0361f026" />

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Local Development

Install dependencies:

```bash
npm install
```

Run the app in development mode:

```bash
npm run dev
npm run tauri dev
```

## Build a Release

Build the frontend and the native Tauri app:

```bash
npm run tauri build
```

## Install a Release `.deb`

After a successful build, the Debian package will be generated under `src-tauri/target/release/bundle/deb/`.

Install it with:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/orbit_1.2.5_amd64.deb
```

If your package filename differs, use tab completion or adjust the path accordingly.

## Notes

- `npm run build` compiles TypeScript and builds the frontend.
- `npm run tauri build` produces platform-specific native bundles, including the Debian package on Linux.
