import { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard, nativeImage } from "electron";
import { spawnSync } from "child_process";
import { ipcMainHandle, isDev, DEV_PORT } from "./util.js";
import { getPreloadPath, getUIPath, getIconPath } from "./pathResolver.js";
import { getStaticData, pollResources } from "./test.js";
import {
  handleClientEvent,
  sessions,
  startScheduler,
  stopScheduler,
} from "./ipc-handlers.js";
import { sessionManager } from "./session-manager.js";
import { generateSessionTitle } from "./libs/util.js";
import type { ClientEvent } from "./types.js";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { basename, extname, join, normalize, relative, resolve, isAbsolute } from "path";

function loadURLWithRetry(
  win: BrowserWindow,
  url: string,
  {
    maxAttempts = 60,
    delayMs = 250,
  }: { maxAttempts?: number; delayMs?: number } = {},
) {
  let attempt = 0;

  const tryLoad = async () => {
    attempt++;
    try {
      await win.loadURL(url);
    } catch (err) {
      if (attempt >= maxAttempts) {
        console.error(
          `[Main] Failed to load dev URL after ${attempt} attempts: ${url}`,
          err,
        );
        return;
      }
      console.log(
        `[Main] Dev server not ready yet. Retrying (${attempt}/${maxAttempts})...`,
      );
      setTimeout(tryLoad, delayMs);
    }
  };

  void tryLoad();
}

app.on("ready", () => {
  // Start the scheduler service
  startScheduler();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: getPreloadPath(),
      spellcheck: true, // Enable spell checking
    },
    icon: getIconPath(),
    titleBarStyle: "hiddenInset",
    backgroundColor: "#FAF9F6",
    trafficLightPosition: { x: 15, y: 18 },
  });

  if (isDev()) loadURLWithRetry(mainWindow, `http://localhost:${DEV_PORT}`);
  else mainWindow.loadFile(getUIPath());

  // Register window with SessionManager for event routing
  sessionManager.registerWindow(mainWindow);

  // Set spell checker languages (English and Russian)
  mainWindow.webContents.session.setSpellCheckerLanguages(["en-US", "ru"]);

  // Enable context menu (right-click) with copy/paste/cut and spell check suggestions
  mainWindow.webContents.on("context-menu", (_, params) => {
    const menuTemplate: any[] = [];

    // Add spelling suggestions if there's a misspelled word
    if (params.misspelledWord) {
      // Add suggestions
      params.dictionarySuggestions.slice(0, 5).forEach((suggestion) => {
        menuTemplate.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      });

      if (params.dictionarySuggestions.length > 0) {
        menuTemplate.push({ type: "separator" });
      }

      // Add "Add to dictionary" option
      menuTemplate.push({
        label: "Add to Dictionary",
        click: () =>
          mainWindow.webContents.session.addWordToSpellCheckerDictionary(
            params.misspelledWord,
          ),
      });

      menuTemplate.push({ type: "separator" });
    }

    // Standard edit menu items
    menuTemplate.push(
      { label: "Copy", role: "copy", enabled: params.selectionText.length > 0 },
      {
        label: "Cut",
        role: "cut",
        enabled: params.isEditable && params.selectionText.length > 0,
      },
      { label: "Paste", role: "paste", enabled: params.isEditable },
      { type: "separator" },
      { label: "Select All", role: "selectAll" },
    );

    const menu = Menu.buildFromTemplate(menuTemplate);
    menu.popup();
  });

  pollResources(mainWindow);

  ipcMainHandle("getStaticData", () => {
    return getStaticData();
  });

  // Handle client events
  ipcMain.on("client-event", (event, data: ClientEvent) => {
    // Get window ID from sender's webContents
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    if (windowId === undefined) {
      console.error("[Main] Unable to determine window ID for client event");
      return;
    }
    handleClientEvent(data, windowId);
  });

  // Handle open directory in Finder/Explorer
  ipcMain.on("open-directory", (_, dirPath: string) => {
    shell.openPath(dirPath);
  });

  // Handle open file in system default app
  ipcMain.on("open-file", (_, filePath: string) => {
    shell.openPath(filePath);
  });

  // Handle list directory contents
  ipcMainHandle("list-directory", async (_, dirPath: string) => {
    try {
      console.log("[FileBrowser] Listing directory:", dirPath);

      // Security: Only allow listing directories within the current session's cwd
      // Get all sessions and find one with matching cwd
      const allSessions = sessions.listSessions();

      // Normalize paths for comparison (handles Cyrillic usernames and case differences on Windows)
      const normalizedDirPath = resolve(dirPath).toLowerCase().normalize("NFC");

      const sessionCwd = allSessions.find((s) => {
        if (!s.cwd) return false;
        const normalizedSessionCwd = resolve(s.cwd)
          .toLowerCase()
          .normalize("NFC");
        return normalizedDirPath.startsWith(normalizedSessionCwd);
      })?.cwd;

      if (!sessionCwd) {
        console.error("[FileBrowser] No active session cwd found");
        return [];
      }

      // Normalize paths and check if dirPath is within sessionCwd
      const normalizedCwd = resolve(sessionCwd).toLowerCase().normalize("NFC");

      if (!normalizedDirPath.startsWith(normalizedCwd)) {
        console.error(
          "[FileBrowser] Access denied: Path is outside session cwd",
          {
            requested: normalizedDirPath,
            allowed: normalizedCwd,
          },
        );
        return [];
      }

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      console.log(`[FileBrowser] Found ${entries.length} entries`);

      const files = await Promise.all(
        entries.map(async (entry: any) => {
          const fullPath = join(dirPath, entry.name);
          let size = undefined;

          if (!entry.isDirectory()) {
            try {
              const stats = await fs.stat(fullPath);
              size = stats.size;
            } catch (e) {
              // Ignore stat errors
            }
          }

          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size,
          };
        }),
      );

      // Sort: directories first, then files, both alphabetically
      const sorted = files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      console.log(`[FileBrowser] Returning ${sorted.length} items`);
      return sorted;
    } catch (error) {
      console.error("[FileBrowser] Failed to list directory:", error);
      return [];
    }
  });

  // Handle session title generation
  ipcMainHandle(
    "generate-session-title",
    async (_: any, userInput: string | null) => {
      return await generateSessionTitle(userInput);
    },
  );

  // Handle recent cwds request
  ipcMainHandle("get-recent-cwds", (_: any, limit?: number) => {
    const boundedLimit = limit ? Math.min(Math.max(limit, 1), 20) : 8;
    return sessions.listRecentCwds(boundedLimit);
  });

  // Handle directory selection
  ipcMainHandle("select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMainHandle("read-clipboard-image", async () => {
    try {
      const image = clipboard.readImage();
      if (!image || image.isEmpty()) return null;
      return { dataUrl: image.toDataURL(), mime: "image/png" };
    } catch (error: any) {
      console.warn("[Main] Failed to read clipboard image:", error);
      return null;
    }
  });

  // Save pasted image into workspace-local attachment folder
  ipcMainHandle(
    "save-pasted-image",
    async (
      _: any,
      payload: { dataUrl: string; cwd: string; fileName?: string },
    ) => {
      const { dataUrl, cwd, fileName } = payload || ({} as any);
      if (!dataUrl || !cwd) {
        throw new Error("Missing image data or workspace folder");
      }

      const normalizedCwd = await fs.realpath(cwd).catch(() => resolve(cwd));
      if (!normalizedCwd || normalizedCwd === ".") {
        throw new Error("Invalid workspace folder");
      }

      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(
        dataUrl,
      );
      if (!match) {
        throw new Error("Invalid image data URL");
      }

      const mime = match[1].toLowerCase();
      const base64 = match[2];
      const buffer = Buffer.from(base64, "base64");

      const maxBytes = 15 * 1024 * 1024;
      if (buffer.length > maxBytes) {
        throw new Error("Image is too large (max 15MB)");
      }

      const mimeToExt: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/heic": "heic",
        "image/heif": "heif",
      };

      const attachmentsDir = join(normalizedCwd, ".localdesk-attachments");
      await fs.mkdir(attachmentsDir, { recursive: true });

      const baseName = fileName
        ? basename(fileName)
        : `pasted-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const sanitizedBase = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const currentExt = extname(sanitizedBase).toLowerCase();
      const derivedExt = (mimeToExt[mime] || mime.split("/")[1] || "png")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      const preferredExt = derivedExt || "png";

      let finalName = sanitizedBase;
      if (!currentExt) {
        finalName = `${sanitizedBase}.${preferredExt}`;
      } else if (preferredExt && currentExt !== `.${preferredExt}`) {
        const withoutExt = sanitizedBase.slice(0, -currentExt.length);
        finalName = `${withoutExt}.${preferredExt}`;
      }

      const fullPath = join(attachmentsDir, finalName);
      await fs.writeFile(fullPath, buffer);

      const relativePath = relative(normalizedCwd, fullPath);

      return {
        path: relativePath,
        name: finalName,
        mime,
        size: buffer.length,
      };
    },
  );

  ipcMainHandle(
    "get-image-preview",
    async (_: any, payload: { cwd: string; path: string; maxSize?: number }) => {
      const { cwd, path, maxSize } = payload || ({} as any);
      if (!cwd || !path) {
        throw new Error("Missing image path or workspace folder");
      }

      const normalizedCwd = normalize(await fs.realpath(cwd).catch(() => resolve(cwd)));
      const fullPath = normalize(await fs.realpath(resolve(normalizedCwd, path)).catch(() => resolve(normalizedCwd, path)));

      const relativePath = relative(normalizedCwd, fullPath);
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new Error("Access denied: Path is outside the workspace folder");
      }

      const stats = await fs.stat(fullPath);
      if (!stats.isFile()) {
        throw new Error("Not a file");
      }

      const maxPixels =
        typeof maxSize === "number" && maxSize > 0
          ? Math.min(maxSize, 512)
          : 320;

      try {
        const image = nativeImage.createFromPath(fullPath);
        if (image && !image.isEmpty()) {
          const size = image.getSize();
          const maxDim = Math.max(size.width, size.height);
          const scale = maxDim > 0 ? Math.min(1, maxPixels / maxDim) : 1;
          const resized = scale < 1
            ? image.resize({
              width: Math.max(1, Math.round(size.width * scale)),
              height: Math.max(1, Math.round(size.height * scale))
            })
            : image;
          return {
            dataUrl: resized.toDataURL(),
            mime: "image/png"
          };
        }
      } catch (error) {
        console.warn("[Main] nativeImage preview failed:", error);
      }

      try {
        const sharpModule = await import("sharp");
        const sharp = (sharpModule as any).default ?? sharpModule;
        const image = sharp(fullPath, { failOnError: false });
        const resized = image.resize({
          width: maxPixels,
          height: maxPixels,
          fit: "inside",
        });
        const webpBuffer = await resized.webp({ quality: 70 }).toBuffer();
        return {
          dataUrl: `data:image/webp;base64,${webpBuffer.toString("base64")}`,
          mime: "image/webp",
        };
      } catch (error) {
        const fileBuffer = await fs.readFile(fullPath);
        if (fileBuffer.length > 2 * 1024 * 1024) {
          throw new Error("Preview too large");
        }
        const ext = extname(fullPath).toLowerCase().replace(".", "") || "png";
        return {
          dataUrl: `data:image/${ext};base64,${fileBuffer.toString("base64")}`,
          mime: `image/${ext}`,
        };
      }
    },
  );

  // Handle opening path in file manager (Finder/Explorer/etc)
  // Handle read memory
  ipcMainHandle("read-memory", async () => {
    try {
      const { homedir } = await import("os");
      const memoryPath = join(homedir(), ".valera", "memory.md");

      try {
        const content = await fs.readFile(memoryPath, "utf-8");
        return content;
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return ""; // File doesn't exist yet
        }
        throw error;
      }
    } catch (error: any) {
      console.error("[Main] Failed to read memory:", error);
      throw error;
    }
  });

  // Handle write memory
  ipcMainHandle("write-memory", async (_, content: string) => {
    try {
      const { homedir } = await import("os");
      const memoryDir = join(homedir(), ".valera");
      const memoryPath = join(memoryDir, "memory.md");

      // Ensure directory exists
      await fs.mkdir(memoryDir, { recursive: true });

      // Write content
      await fs.writeFile(memoryPath, content, "utf-8");
      console.log("[Main] Memory saved to:", memoryPath);
    } catch (error: any) {
      console.error("[Main] Failed to write memory:", error);
      throw error;
    }
  });

  ipcMainHandle("open-path-in-finder", async (_, pathToOpen: string) => {
    try {
      console.log("[Main] Opening path in file manager:", pathToOpen);
      // shell.openPath works on all platforms (macOS, Windows, Linux)
      // It opens the path in the default file manager
      const result = await shell.openPath(pathToOpen);
      if (result) {
        console.error("[Main] Failed to open path:", result);
        return { success: false, error: result };
      }
      return { success: true };
    } catch (error: any) {
      console.error("[Main] Error opening path:", error);
      return { success: false, error: error.message };
    }
  });

  // Handle get file old content (from git HEAD or snapshot)
  ipcMainHandle("get-file-old-content", async (_, filePath: string, cwd: string, useGit: boolean = true) => {
    try {
      if (useGit) {
        // Use git (original behavior), but fallback to snapshot if git is not available

        // First, check if this is a git repository
        const isRepo = spawnSync("git", ["rev-parse", "--git-dir"], {
          cwd,
          stdio: "ignore",
        }).status === 0;

        if (!isRepo) {
          // Not a git repo, fallback to snapshot
          return await getFileSnapshot(filePath, cwd);
        }

        // Try to get file content from git HEAD
        const result = spawnSync("git", ["show", `HEAD:${filePath}`], {
          cwd,
          encoding: "utf8",
        });

        if (result.status === 0) {
          return result.stdout?.toString() ?? "";
        }

        // File doesn't exist in git HEAD (new file) - fallback to snapshot
        return await getFileSnapshot(filePath, cwd);
      } else {
        // Use file snapshot
        return await getFileSnapshot(filePath, cwd);
      }
    } catch (error: any) {
      console.error(`[Main] Failed to get old content for ${filePath}:`, error);
      throw error;
    }
  });

  const resolvePathWithin = async (baseDir: string, unsafePath: string): Promise<string> => {
    const { resolve, relative, isAbsolute, join } = await import("path");
    const base = resolve(baseDir);
    const target = resolve(join(base, unsafePath));
    const rel = relative(base, target);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
      throw new Error(`[path] Refusing to access path outside base dir: ${unsafePath}`);
    }
    return target;
  };

  // Helper function to get file snapshot
  async function getFileSnapshot(filePath: string, cwd: string): Promise<string> {
    const snapshotsDir = await resolvePathWithin(cwd, ".valedesk/snapshots");
    const snapshotPath = await resolvePathWithin(snapshotsDir, filePath);

    try {
      const content = await fs.readFile(snapshotPath, "utf-8");
      return content;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // No snapshot exists, return empty string (new file)
        return "";
      }
      throw error;
    }
  }

  // Handle get file snapshot
  ipcMainHandle("get-file-snapshot", async (_, filePath: string, cwd: string) => {
    try {
      return await getFileSnapshot(filePath, cwd);
    } catch (error: any) {
      console.error(`[Main] Failed to get file snapshot for ${filePath}:`, error);
      throw error;
    }
  });

  // Handle save file snapshot
  ipcMainHandle("save-file-snapshot", async (_, filePath: string, cwd: string, content: string) => {
    try {
      const { dirname } = await import("path");
      const snapshotsDir = await resolvePathWithin(cwd, ".valedesk/snapshots");
      const snapshotPath = await resolvePathWithin(snapshotsDir, filePath);

      // Create parent directory if it doesn't exist
      const snapshotDir = dirname(snapshotPath);
      await fs.mkdir(snapshotDir, { recursive: true });

      // Save the content
      await fs.writeFile(snapshotPath, content, "utf-8");
    } catch (error: any) {
      console.error(`[Main] Failed to save file snapshot for ${filePath}:`, error);
      throw error;
    }
  });

  // Handle get file new content (current file)
  ipcMainHandle("get-file-new-content", async (_, filePath: string, cwd: string) => {
    try {
      const fullPath = await resolvePathWithin(cwd, filePath);
      const content = await fs.readFile(fullPath, "utf-8");
      return content;
    } catch (error: any) {
      console.error(`[Main] Failed to get new content for ${filePath}:`, error);
      throw error;
    }
  });

  const isValidCommit = (commit: string) => /^[0-9a-f]{7,64}([~^][0-9]*)*$/i.test(commit);

  ipcMainHandle("get-file-content-at-commit", async (_, filePath: string, cwd: string, commit: string) => {
    try {
      if (!isValidCommit(commit)) return "";

      const result = spawnSync("git", ["show", `${commit}:${filePath}`], { cwd, encoding: "utf8" });
      if (result.status === 0) {
        return result.stdout?.toString() ?? "";
      }
      return "";
    } catch (error: any) {
      console.error(`[Main] Failed to get commit content for ${filePath}:`, error);
      throw error;
    }
  });

  // Handle get build info
  ipcMainHandle("get-build-info", async () => {
    try {
      const buildInfoPath = join(
        app.getAppPath(),
        "dist-electron",
        "build-info.json",
      );
      const buildInfo = JSON.parse(await fs.readFile(buildInfoPath, "utf-8"));
      return buildInfo;
    } catch (error: any) {
      console.error("[Main] Failed to read build info:", error);
      // Fallback to package.json version if build-info.json is missing
      const packageJsonPath = join(app.getAppPath(), "package.json");
      try {
        const packageJson = JSON.parse(
          await fs.readFile(packageJsonPath, "utf-8"),
        );
        return {
          version: packageJson.version,
          commit: "unknown",
          commitShort: "dev",
          buildTime: "unknown",
        };
      } catch {
        return {
          version: "0.0.0",
          commit: "unknown",
          commitShort: "dev",
          buildTime: "unknown",
        };
      }
    }
  });

  ipcMainHandle("check-git-available", async () => {
    try {
      const result = spawnSync("git", ["--version"], { stdio: "ignore" });
      return result.status === 0;
    } catch (error: any) {
      console.error("[Main] Failed to check git availability:", error);
      return false;
    }
  });

  // Handle opening external URLs in default browser
  ipcMainHandle("open-external-url", async (_, url: string) => {
    try {
      console.log("[Main] Opening external URL:", url);
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error("[Main] Error opening URL:", error);
      return { success: false, error: error.message };
    }
  });
});
// Stop scheduler on app quit
app.on("will-quit", () => {
  stopScheduler();
});
