"use client";

import clsx from "clsx";
import Image from "next/image";
import {
  Activity,
  AudioLines,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Eye,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  FolderTree,
  Gauge,
  Grid3X3,
  GraduationCap,
  HardDriveUpload,
  Heart,
  Image as ImageIcon,
  KeyRound,
  Layers,
  LayoutDashboard,
  List,
  LockKeyhole,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Terminal,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SafeFileRecord } from "@/lib/types";

type User = { id: string; email: string };
type DashboardData = {
  totalFiles: number;
  logicalSize: string;
  uploadsToday: number;
  failedUploads: number;
  waitingInQueue: number;
  categories: { category: string; label: string; count: number }[];
  recent: { id: string; name: string; category: string; size: string; createdAt: string }[];
  largest: { id: string; name: string; size: string }[];
};
type QueueItem = {
  id: string;
  file: File;
  displayName: string;
  folderId: string | null;
  progress: number;
  status: "queued" | "uploading" | "completed" | "failed" | "cancelled";
  error?: string;
  xhr?: XMLHttpRequest;
};
type LogLine = { time: string; level: "info" | "success" | "warning" | "error"; message: string };
type Destination = { category: string; label: string; source: string; configured: boolean; chatIdPreview: string; chatId?: string };
type ActivityLog = { id: string; action: string; targetId: string | null; ipAddress: string | null; createdAt: string; metadata: unknown };
type FolderNode = { id: string; name: string; parentId: string | null; createdAt: string };

const PRIVATE_PASSCODE = "6639";

const sidebar = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["upload", "Upload", Upload],
  ["all", "All Files", Database],
  ["project", "Project", Layers],
  ["image", "Images", ImageIcon],
  ["techweb", "Technology Web", GraduationCap],
  ["favourites", "Favourites", Heart],
  ["private", "Private Content", LockKeyhole],
  ["activity", "Activity Log", Activity],
  ["destinations", "Telegram Destinations", Bot],
  ["settings", "Settings", Settings],
] as const;

const categoryIcons: Record<string, typeof FileText> = {
  image: ImageIcon,
  video: Video,
  audio: AudioLines,
  document: FileText,
  archive: FileText,
  other: MoreHorizontal,
};

function bytes(value: string | number | bigint) {
  const size = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  return `${(size / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function stamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

function childrenOf(folders: FolderNode[], parentId: string | null) {
  return folders.filter((folder) => folder.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
}

function folderById(folders: FolderNode[], id: string | null) {
  return folders.find((folder) => folder.id === id) ?? null;
}

function folderPath(folders: FolderNode[], id: string | null): FolderNode[] {
  const path: FolderNode[] = [];
  let current = folderById(folders, id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? folderById(folders, current.parentId) : null;
  }
  return path;
}

function rootFolder(folders: FolderNode[], name: string) {
  return folders.find((folder) => folder.parentId === null && folder.name === name) ?? null;
}

export default function M41nitorTerminal() {
  const [user, setUser] = useState<User | null>(null);
  const [configured, setConfigured] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [active, setActive] = useState<(typeof sidebar)[number][0]>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [files, setFiles] = useState<SafeFileRecord[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([{ time: stamp(), level: "info", message: "M41NITOR terminal initialized" }]);
  const [login, setLogin] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [telegramResults, setTelegramResults] = useState<unknown[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [techFolderId, setTechFolderId] = useState<string | null>(null);
  const [privateUnlocked, setPrivateUnlocked] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string, level: LogLine["level"] = "info") => {
    setLogs((current) => [{ time: stamp(), level, message }, ...current].slice(0, 120));
  }, []);

  const refreshCsrf = useCallback(async () => {
    const data = await api<{ csrfToken: string }>("/api/auth/csrf");
    setCsrf(data.csrfToken);
    return data.csrfToken;
  }, []);

  const refreshFolders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api<{ folders: FolderNode[] }>("/api/folders");
      setFolders(data.folders);
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Unable to load folders", "warning");
    }
  }, [addLog, user]);

  const techRoot = useMemo(() => rootFolder(folders, "Technology Web"), [folders]);
  const projectRoot = useMemo(() => rootFolder(folders, "Project"), [folders]);
  const privateRoot = useMemo(() => rootFolder(folders, "Private Content"), [folders]);

  const activeFolderScope = useMemo(() => {
    if (active === "techweb") return techFolderId ?? techRoot?.id ?? null;
    if (active === "project") return projectRoot?.id ?? null;
    if (active === "private") return privateUnlocked ? privateRoot?.id ?? null : "__locked__";
    return undefined;
  }, [active, techFolderId, techRoot, projectRoot, privateRoot, privateUnlocked]);

  const refreshFiles = useCallback(async () => {
    if (!user) return;
    if (activeFolderScope === "__locked__") {
      setFiles([]);
      return;
    }
    const params = new URLSearchParams({ q: query, sort });
    if (active === "image") params.set("category", "image");
    if (typeof activeFolderScope === "string") params.set("folderId", activeFolderScope);
    const data = await api<{ files: SafeFileRecord[] }>(`/api/files?${params}`);
    setFiles(data.files);
  }, [active, activeFolderScope, query, sort, user]);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    try {
      setDashboard(await api<DashboardData>("/api/dashboard"));
    } catch (error) {
      addLog(error instanceof Error ? error.message : "Dashboard unavailable", "warning");
    }
  }, [addLog, user]);

  useEffect(() => {
    api<{ configured: boolean; user: User | null }>("/api/auth/me")
      .then((data) => {
        setConfigured(data.configured);
        setUser(data.user);
        if (data.user) refreshCsrf();
      })
      .catch(() => setConfigured(false));
  }, [refreshCsrf]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      refreshFiles();
      refreshDashboard();
      refreshFolders();
    }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshFiles, refreshDashboard, refreshFolders]);

  useEffect(() => {
    if (active !== "techweb") setTechFolderId(null);
  }, [active]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? []);
      if (pasted.length) stageFiles(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const visibleFiles = useMemo(() => {
    if (active === "favourites") return files.filter((file) => file.isFavourite);
    return files;
  }, [active, files]);

  const activeItem = useMemo(() => sidebar.find(([id]) => id === active) ?? sidebar[0], [active]);
  const quickNav = useMemo(() => sidebar.filter(([id]) => ["dashboard", "upload", "all", "techweb"].includes(id)), []);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    try {
      const data = await api<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(login) });
      setUser(data.user);
      await refreshCsrf();
      addLog("Administrator authenticated", "success");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
      addLog("Login attempt rejected", "error");
    }
  }

  async function logout() {
    const token = csrf || await refreshCsrf();
    await api("/api/auth/logout", { method: "POST", headers: { "x-csrf-token": token } });
    setUser(null);
    setPrivateUnlocked(false);
  }

  // --- Upload staging: files wait here until the user confirms/edits names ---
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [uploadFolderId, setUploadFolderId] = useState<string>("");

  function stageFiles(incoming: File[]) {
    if (!incoming.length) return;
    setPendingFiles(incoming);
  }

  function confirmStagedUpload(named: { file: File; displayName: string }[], folderId: string) {
    const items: QueueItem[] = named.map(({ file, displayName }) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      displayName,
      folderId: folderId || null,
      progress: 0,
      status: "queued" as const,
    }));
    setQueue((current) => [...items, ...current]);
    setPendingFiles(null);
    for (const item of items) {
      addLog(`Queued for upload: ${item.displayName}`);
      uploadItem(item);
    }
  }

  async function uploadItem(item: QueueItem) {
    const token = csrf || await refreshCsrf();
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading" } : entry));
    addLog(`Verifying MIME type: ${item.file.type || "server-side inspection"}`);
    addLog("Calculating checksum on server...");
    const form = new FormData();
    form.append("files", item.file);
    form.append("displayName", item.displayName);
    if (item.folderId) form.append("folderId", item.folderId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("x-csrf-token", token);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress, xhr } : entry));
      }
    };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = data.results?.[0];
        if (result?.status === "completed") {
          setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, progress: 100, status: "completed" } : entry));
          addLog("Telegram message created successfully", "success");
          addLog("Metadata saved", "success");
          addLog("Upload complete", "success");
          refreshFiles();
          refreshDashboard();
        } else if (result?.status === "duplicate") {
          setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: "Duplicate file prevented" } : entry));
          addLog("Duplicate file prevented", "warning");
        } else {
          setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: result?.error ?? "Upload failed" } : entry));
          addLog(result?.error ?? "Upload failed", "error");
        }
      } else {
        setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: data.error ?? "Upload failed" } : entry));
        addLog(data.error ?? "Upload failed", "error");
      }
    };
    xhr.onerror = () => {
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: "Network interruption" } : entry));
      addLog("Network interruption during upload", "error");
    };
    xhr.send(form);
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, xhr } : entry));
  }

  function cancelUpload(item: QueueItem) {
    item.xhr?.abort();
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "cancelled" } : entry));
    addLog(`Cancelled pending upload: ${item.file.name}`, "warning");
  }

  async function mutateFile(file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) {
    const token = csrf || await refreshCsrf();
    await api("/api/files", { method: "PATCH", headers: { "x-csrf-token": token }, body: JSON.stringify({ id: file.id, ...patch }) });
    await refreshFiles();
  }

  async function downloadFile(file: SafeFileRecord) {
    const token = csrf || await refreshCsrf();
    const data = await api<{ url: string }>("/api/files/" + file.id + "/download-link", { method: "POST", headers: { "x-csrf-token": token } });
    window.location.href = data.url;
  }

  async function deleteFile(file: SafeFileRecord, permanent = false) {
    const token = csrf || await refreshCsrf();
    const confirmationName = permanent ? window.prompt(`Type ${file.displayName} to permanently delete`) : undefined;
    if (permanent && confirmationName !== file.displayName && confirmationName !== file.originalName) return;
    await api(`/api/files/${file.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": token },
      body: JSON.stringify({ permanent, confirmationName }),
    });
    addLog(permanent ? "Permanent delete recorded" : "File moved to Trash", permanent ? "warning" : "info");
    await refreshFiles();
  }

  async function createFolder(name: string, parentId: string | null) {
    const token = csrf || await refreshCsrf();
    await api("/api/folders", { method: "POST", headers: { "x-csrf-token": token }, body: JSON.stringify({ name, parentId }) });
    addLog(`Folder created: ${name}`, "success");
    await refreshFolders();
  }

  async function deleteFolder(id: string, name: string) {
    const token = csrf || await refreshCsrf();
    await api(`/api/folders/${id}`, { method: "DELETE", headers: { "x-csrf-token": token } });
    addLog(`Folder deleted: ${name}`, "warning");
    await refreshFolders();
    await refreshFiles();
  }

  async function runTelegramCheck() {
    const token = csrf || await refreshCsrf();
    const data = await api<{ results: unknown[] }>("/api/settings/telegram", { method: "POST", headers: { "x-csrf-token": token } });
    setTelegramResults(data.results);
    const failed = data.results
      .filter((result): result is { label?: string; error?: string } => Boolean(result && typeof result === "object" && "ok" in result && !result.ok))
      .map((result) => `${result.label ?? "Destination"}: ${result.error ?? "not configured"}`);
    if (failed.length) {
      addLog(`Telegram health check found issues: ${failed.join("; ")}`, "warning");
    } else {
      addLog("Telegram destination health check completed", "success");
    }
  }

  if (!configured) {
    return <SetupMissing />;
  }

  if (!user) {
    return (
      <main className="terminal-grid app-surface flex min-h-screen items-center justify-center p-6">
        <form onSubmit={submitLogin} className="glass-panel page-transition w-full max-w-md border border-[#4C0033] p-6 shadow-2xl">
          <div className="mb-8 flex items-center gap-3">
            <BrandLogo className="size-14" />
            <div>
              <h1 className="text-2xl font-semibold text-[#EEEEEE]">M41NITOR</h1>
              <p className="text-sm text-[#DDDDDD]">Telegram-backed expandable storage terminal</p>
            </div>
          </div>
          <label className="mb-4 block text-sm text-[#DDDDDD]">
            Administrator email
            <input className="focus-ring glass-input mt-2 w-full border border-[#4C0033] px-3 py-3 text-[#EEEEEE]" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} autoComplete="username" />
          </label>
          <label className="mb-4 block text-sm text-[#DDDDDD]">
            Password
            <input className="focus-ring glass-input mt-2 w-full border border-[#4C0033] px-3 py-3 text-[#EEEEEE]" type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} autoComplete="current-password" />
          </label>
          {loginError && <p className="glass-raised mb-4 border border-[#8b1a2b] px-3 py-2 text-sm text-[#EEEEEE]">{loginError}</p>}
          <button className="focus-ring flex w-full items-center justify-center gap-2 bg-[#4C0033] px-4 py-3 font-semibold text-[#EEEEEE] hover:bg-[#650044]" type="submit">
            <LockKeyhole className="size-4" aria-hidden />
            Enter Terminal
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="app-surface flex min-h-screen text-[#EEEEEE]">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/70" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)} />
          <aside className="glass-panel modal-pop relative flex h-full w-[min(88vw,22rem)] flex-col border-r border-white/10 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-[#4C0033] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <BrandLogo className="size-9 shrink-0" />
                <span className="truncate text-sm font-semibold">M41NITOR</span>
              </div>
              <button className="focus-ring p-2 text-[#DDDDDD]" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation">
                <X className="size-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {sidebar.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => {
                    setActive(id);
                    setMobileMenuOpen(false);
                  }}
                  className={clsx("nav-link focus-ring flex w-full items-center gap-3 px-3 py-3 text-left text-sm text-[#DDDDDD]", active === id && "glass-active text-[#EEEEEE]")}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </nav>
            <div className="border-t border-[#4C0033] p-3">
              <button className="focus-ring flex w-full items-center gap-2 border border-[#4C0033] px-3 py-3 text-left text-sm text-[#DDDDDD]" onClick={logout}>
                <LogOut className="size-4" aria-hidden />
                <span className="min-w-0 truncate">{user.email}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className={clsx("glass-panel hidden border-r border-white/10 transition-all duration-300 md:block", collapsed ? "w-20" : "w-72")}>
        <div className="flex h-16 items-center justify-between border-b border-[#4C0033] px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <BrandLogo className="size-9 shrink-0" />
            {!collapsed && <span className="truncate text-sm font-semibold">M41NITOR</span>}
          </div>
          <button className="focus-ring p-2 text-[#DDDDDD]" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </button>
        </div>
        <nav className="space-y-1 p-3">
          {sidebar.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setActive(id)} className={clsx("nav-link focus-ring flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[#DDDDDD]", active === id && "glass-raised text-[#EEEEEE]")}>
              <Icon className="size-4 shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="glass-panel sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 border-b border-[#4C0033] px-3 py-3 md:px-4">
          <div className="flex w-full items-center gap-3 md:hidden">
            <button className="focus-ring border border-[#4C0033] p-2 text-[#DDDDDD]" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <BrandLogo className="size-7 shrink-0" />
                <p className="truncate text-sm font-semibold">{activeItem[1]}</p>
              </div>
              <p className="truncate text-xs text-[#DDDDDD]">Secure Telegram storage terminal</p>
            </div>
            <button className="focus-ring border border-[#4C0033] p-2 text-[#DDDDDD]" onClick={logout} aria-label="Log out">
              <LogOut className="size-5" />
            </button>
          </div>
          <div className="relative min-w-0 flex-1 basis-full md:min-w-64 md:basis-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#DDDDDD]" aria-hidden />
            <input className="focus-ring glass-input w-full border border-[#4C0033] py-2 pl-9 pr-3 text-sm" placeholder="Search files, MIME types, tags, checksums" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <div className="hidden flex-wrap items-center gap-3 xl:flex">
            <StatusChip icon={Gauge} label="Connection" value="Backend guarded" />
            <StatusChip icon={Bot} label="Bot" value="Health check" />
            <StatusChip icon={HardDriveUpload} label="Queue" value={String(queue.filter((item) => item.status === "uploading").length)} />
            <StatusChip icon={Database} label="Logical storage used" value={bytes(dashboard?.logicalSize ?? 0)} />
          </div>
          <button className="focus-ring hidden items-center gap-2 border border-[#4C0033] px-3 py-2 text-sm text-[#DDDDDD] md:flex" onClick={logout}>
            <LogOut className="size-4" aria-hidden />
            {user.email}
          </button>
        </header>

        <div className="mx-auto grid w-full max-w-[100rem] min-h-0 flex-1 gap-4 px-4 py-4 pb-28 sm:px-5 md:p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <section key={active} className="page-transition min-w-0 space-y-4">
            {active === "dashboard" && <Dashboard dashboard={dashboard} />}
            {active === "upload" && (
              <UploadPanel
                dragging={dragging}
                setDragging={setDragging}
                fileInput={fileInput}
                folderInput={folderInput}
                stageFiles={stageFiles}
                queue={queue}
                cancelUpload={cancelUpload}
                uploadItem={uploadItem}
                folders={folders}
                uploadFolderId={uploadFolderId}
                setUploadFolderId={setUploadFolderId}
              />
            )}
            {active === "destinations" && <Destinations csrf={csrf} refreshCsrf={refreshCsrf} runTelegramCheck={runTelegramCheck} results={telegramResults} addLog={addLog} />}
            {active === "settings" && <SettingsPanel csrf={csrf} refreshCsrf={refreshCsrf} addLog={addLog} />}
            {active === "activity" && <ActivityPanel />}
            {active === "techweb" && (
              <TechnologyWeb
                folders={folders}
                currentId={techFolderId ?? techRoot?.id ?? null}
                rootId={techRoot?.id ?? null}
                setCurrentId={setTechFolderId}
                createFolder={createFolder}
                deleteFolder={deleteFolder}
                files={visibleFiles}
                view={view}
                setView={setView}
                sort={sort}
                setSort={setSort}
                mutateFile={mutateFile}
                downloadFile={downloadFile}
                deleteFile={deleteFile}
              />
            )}
            {active === "private" && !privateUnlocked && <PrivatePasscodeGate onUnlock={() => setPrivateUnlocked(true)} />}
            {active === "private" && privateUnlocked && (
              <FileManager title="Private Content" files={visibleFiles} view={view} setView={setView} sort={sort} setSort={setSort} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} />
            )}
            {["all", "project", "image", "favourites"].includes(active) && (
              <FileManager
                title={activeItem[1]}
                files={visibleFiles}
                view={view}
                setView={setView}
                sort={sort}
                setSort={setSort}
                mutateFile={mutateFile}
                downloadFile={downloadFile}
                deleteFile={deleteFile}
              />
            )}
          </section>
          <div className="hidden lg:block">
            <TerminalPanel logs={logs} />
          </div>
        </div>

        <nav className="glass-panel fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#4C0033] px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 md:hidden">
          {quickNav.map(([id, , Icon]) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={clsx("focus-ring flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.65rem] text-[#DDDDDD]", active === id && "border border-[#4C0033] text-[#EEEEEE]")}
            >
              <Icon className="size-5" aria-hidden />
              <span className="w-full truncate text-center">{id === "dashboard" ? "Home" : id === "upload" ? "Upload" : id === "all" ? "Files" : "Tech Web"}</span>
            </button>
          ))}
        </nav>
      </section>

      {pendingFiles && (
        <RenameBeforeUploadModal
          files={pendingFiles}
          folders={folders}
          defaultFolderId={uploadFolderId}
          onCancel={() => setPendingFiles(null)}
          onConfirm={confirmStagedUpload}
        />
      )}
    </main>
  );
}

function SetupMissing() {
  return (
    <main className="terminal-grid app-surface flex min-h-screen items-center justify-center p-6">
      <section className="glass-panel page-transition max-w-2xl border border-[#4C0033] p-6">
        <div className="mb-4 flex items-center gap-3 text-[#EEEEEE]">
          <ShieldAlert className="size-6" aria-hidden />
          <h1 className="text-xl font-semibold">Configuration required</h1>
        </div>
        <p className="text-sm leading-6 text-[#DDDDDD]">
          Set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` before signing in. Telegram bot and chat ID settings are required before uploads can complete.
        </p>
      </section>
    </main>
  );
}

function BrandLogo({ className = "size-8" }: { className?: string }) {
  return (
    <Image
      src="/brand/m41nitor-logo.png"
      alt=""
      width={96}
      height={96}
      className={clsx("object-contain drop-shadow-[0_0_14px_rgba(76,0,51,0.85)]", className)}
      aria-hidden
    />
  );
}

function StatusChip({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="glass-raised flex items-center gap-2 border border-[#4C0033] px-3 py-2 text-xs">
      <Icon className="size-4 text-[#EEEEEE]" aria-hidden />
      <span className="text-[#DDDDDD]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Dashboard({ dashboard }: { dashboard: DashboardData | null }) {
  const stats = [
    ["Total uploaded files", dashboard?.totalFiles ?? 0],
    ["Logical storage used", bytes(dashboard?.logicalSize ?? 0)],
    ["Uploads today", dashboard?.uploadsToday ?? 0],
    ["Failed uploads", dashboard?.failedUploads ?? 0],
    ["Files waiting in queue", dashboard?.waitingInQueue ?? 0],
  ];
  return (
    <div className="space-y-4">
      <Panel title="Dashboard">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {stats.map(([label, value]) => (
            <div key={label} className="glass-raised hover-card min-w-0 p-3 sm:p-4">
              <p className="min-h-8 text-[0.68rem] leading-4 text-[#DDDDDD] sm:min-h-0 sm:text-xs">{label}</p>
              <p className="mt-2 break-words text-xl font-semibold text-[#EEEEEE] sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Category Distribution">
          <div className="space-y-3">
            {(dashboard?.categories ?? []).map((item) => (
              <div key={item.category}>
                <div className="mb-1 flex justify-between text-xs text-[#DDDDDD]">
                  <span>{item.label}</span>
                  <span>{item.count}</span>
                </div>
                <div className="h-2 bg-black/60">
                  <div className="h-full bg-[#4C0033]" style={{ width: `${Math.min(100, item.count * 12)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Recently Uploaded">
          <FileRows
            files={(dashboard?.recent ?? []).map((file) => ({ id: file.id, displayName: file.name, category: file.category, fileSize: file.size } as SafeFileRecord))}
            compact
          />
        </Panel>
      </div>
    </div>
  );
}

function flattenFolderOptions(folders: FolderNode[]) {
  const options: { id: string; label: string }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const folder of childrenOf(folders, parentId)) {
      options.push({ id: folder.id, label: `${"— ".repeat(depth)}${folder.name}` });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return options;
}

function UploadPanel({ dragging, setDragging, fileInput, folderInput, stageFiles, queue, cancelUpload, uploadItem, folders, uploadFolderId, setUploadFolderId }: {
  dragging: boolean;
  setDragging: (value: boolean) => void;
  fileInput: React.RefObject<HTMLInputElement | null>;
  folderInput: React.RefObject<HTMLInputElement | null>;
  stageFiles: (files: File[]) => void;
  queue: QueueItem[];
  cancelUpload: (item: QueueItem) => void;
  uploadItem: (item: QueueItem) => void;
  folders: FolderNode[];
  uploadFolderId: string;
  setUploadFolderId: (value: string) => void;
}) {
  const folderProps = { webkitdirectory: "", directory: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>;
  const options = useMemo(() => flattenFolderOptions(folders), [folders]);
  return (
    <div className="space-y-4">
      <Panel title="Upload Destination">
        <label className="block text-xs text-[#DDDDDD]">
          Choose which folder new uploads should be filed into
          <select className="focus-ring glass-input mt-2 w-full border border-[#4C0033] px-3 py-2 text-sm text-[#EEEEEE]" value={uploadFolderId} onChange={(event) => setUploadFolderId(event.target.value)}>
            <option value="">No folder (goes to All Files)</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </Panel>
      <Panel title="Upload Terminal">
        <div
          className={clsx("focus-ring flex min-h-72 flex-col items-center justify-center border border-dashed p-8 text-center transition-colors duration-200", dragging ? "border-[#4C0033] bg-[#4C0033]/20" : "border-[#4C0033]/60 bg-black/40")}
          tabIndex={0}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            stageFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <HardDriveUpload className="mb-4 size-12 text-[#EEEEEE]" aria-hidden />
          <h2 className="text-xl font-semibold">Drop files into the secure upload channel</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#DDDDDD]">Files are validated on the backend, checksummed, classified by verified MIME type, optionally encrypted, and routed to the configured Telegram destination. You&apos;ll be asked to confirm a name before each upload starts.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="focus-ring flex items-center gap-2 bg-[#4C0033] px-4 py-2 text-sm font-semibold text-[#EEEEEE] hover:bg-[#650044]" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Select Files
            </button>
            <button className="focus-ring flex items-center gap-2 border border-[#4C0033] px-4 py-2 text-sm hover:bg-[#4C0033]/20" onClick={() => folderInput.current?.click()}>
              <FolderIcon className="size-4" aria-hidden />
              Select Folder
            </button>
          </div>
          <input ref={fileInput} className="hidden" type="file" multiple onChange={(event) => { stageFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <input ref={folderInput} className="hidden" type="file" multiple {...folderProps} onChange={(event) => { stageFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
        </div>
      </Panel>
      <Panel title="Current Upload Queue">
        <div className="space-y-3">
          {queue.length === 0 && <Empty label="No pending uploads" />}
          {queue.map((item) => (
            <div key={item.id} className="glass-raised hover-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.displayName}</p>
                  <p className="text-xs text-[#DDDDDD]">{bytes(item.file.size)} / {item.status}</p>
                </div>
                <div className="flex gap-2">
                  {item.status === "failed" && <button className="focus-ring p-2 text-[#EEEEEE]" aria-label="Retry upload" onClick={() => uploadItem(item)}><RefreshCw className="size-4" /></button>}
                  {item.status === "uploading" && <button className="focus-ring p-2 text-[#DDDDDD]" aria-label="Cancel upload" onClick={() => cancelUpload(item)}><X className="size-4" /></button>}
                </div>
              </div>
              <div className="mt-3 h-2 bg-black/60"><div className="h-full bg-[#4C0033] transition-all duration-300" style={{ width: `${item.progress}%` }} /></div>
              {item.error && <p className="mt-2 text-xs text-[#EEEEEE]">{item.error}</p>}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RenameBeforeUploadModal({ files, folders, defaultFolderId, onCancel, onConfirm }: {
  files: File[];
  folders: FolderNode[];
  defaultFolderId: string;
  onCancel: () => void;
  onConfirm: (named: { file: File; displayName: string }[], folderId: string) => void;
}) {
  const [names, setNames] = useState<string[]>(files.map((file) => file.name));
  const [folderId, setFolderId] = useState(defaultFolderId);
  const options = useMemo(() => flattenFolderOptions(folders), [folders]);
  const path = folderId ? folderPath(folders, folderId).map((f) => f.name).join(" / ") : "All Files (no folder)";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="glass-panel modal-pop w-full max-w-lg border border-[#4C0033] p-5">
        <div className="mb-4 flex items-center gap-2 text-[#EEEEEE]">
          <Pencil className="size-5" aria-hidden />
          <h2 className="text-lg font-semibold">Name your file{files.length > 1 ? "s" : ""} before uploading</h2>
        </div>
        <label className="mb-4 block text-xs text-[#DDDDDD]">
          Destination folder
          <select className="focus-ring glass-input mt-2 w-full border border-[#4C0033] px-3 py-2 text-sm text-[#EEEEEE]" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
            <option value="">No folder (goes to All Files)</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-[0.68rem] text-[#DDDDDD]/70">Uploading to: {path}</span>
        </label>
        <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
          {files.map((file, index) => (
            <label key={`${file.name}-${index}`} className="block text-xs text-[#DDDDDD]">
              {file.name}
              <input
                className="focus-ring glass-input mt-1 w-full border border-[#4C0033] px-3 py-2 text-sm text-[#EEEEEE]"
                value={names[index]}
                onChange={(event) => setNames((current) => current.map((name, i) => i === index ? event.target.value : name))}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button className="focus-ring border border-[#4C0033] px-4 py-2 text-sm text-[#DDDDDD] hover:bg-[#4C0033]/20" onClick={onCancel}>Cancel</button>
          <button
            className="focus-ring flex items-center gap-2 bg-[#4C0033] px-4 py-2 text-sm font-semibold text-[#EEEEEE] hover:bg-[#650044]"
            onClick={() => onConfirm(files.map((file, index) => ({ file, displayName: names[index]?.trim() || file.name })), folderId)}
          >
            <Upload className="size-4" aria-hidden />
            Confirm &amp; Upload
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, title, message, onConfirm, onCancel }: { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="glass-panel modal-pop w-full max-w-sm border border-[#4C0033] p-5">
        <div className="mb-3 flex items-center gap-2 text-[#EEEEEE]">
          <ShieldAlert className="size-5" aria-hidden />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <p className="mb-5 text-sm leading-6 text-[#DDDDDD]">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="focus-ring border border-[#4C0033] px-4 py-2 text-sm text-[#DDDDDD] hover:bg-[#4C0033]/20" onClick={onCancel}>No</button>
          <button className="focus-ring bg-[#4C0033] px-4 py-2 text-sm font-semibold text-[#EEEEEE] hover:bg-[#650044]" onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
}

function PrivatePasscodeGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (code === PRIVATE_PASSCODE) {
      setError("");
      onUnlock();
    } else {
      setError("Incorrect passcode");
    }
  }
  return (
    <Panel title="Private Content">
      <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col items-center gap-4 py-8 text-center">
        <KeyRound className="size-10 text-[#EEEEEE]" aria-hidden />
        <p className="text-sm text-[#DDDDDD]">Enter your 6-digit passcode to unlock private content.</p>
        <input
          className="focus-ring glass-input w-full border border-[#4C0033] px-3 py-3 text-center text-lg tracking-[0.5em] text-[#EEEEEE]"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          maxLength={6}
          autoFocus
        />
        {error && <p className="text-sm text-[#EEEEEE]">{error}</p>}
        <button className="focus-ring flex items-center gap-2 bg-[#4C0033] px-5 py-2 text-sm font-semibold text-[#EEEEEE] hover:bg-[#650044]" type="submit">
          <LockKeyhole className="size-4" aria-hidden />
          Unlock
        </button>
      </form>
    </Panel>
  );
}

function TechnologyWeb({ folders, currentId, rootId, setCurrentId, createFolder, deleteFolder, files, view, setView, sort, setSort, mutateFile, downloadFile, deleteFile }: {
  folders: FolderNode[];
  currentId: string | null;
  rootId: string | null;
  setCurrentId: (id: string | null) => void;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  deleteFolder: (id: string, name: string) => Promise<void>;
  files: SafeFileRecord[];
  view: "grid" | "table";
  setView: (view: "grid" | "table") => void;
  sort: string;
  setSort: (sort: string) => void;
  mutateFile: (file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) => Promise<void>;
  downloadFile: (file: SafeFileRecord) => Promise<void>;
  deleteFile: (file: SafeFileRecord, permanent?: boolean) => Promise<void>;
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<FolderNode | null>(null);
  const path = useMemo(() => folderPath(folders, currentId), [folders, currentId]);
  const children = useMemo(() => childrenOf(folders, currentId), [folders, currentId]);

  async function submitNewFolder(event: React.FormEvent) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name, currentId);
    setNewFolderName("");
  }

  return (
    <div className="space-y-4">
      <Panel title="Technology Web">
        <div className="mb-4 flex flex-wrap items-center gap-1 text-xs text-[#DDDDDD]">
          <button className="focus-ring flex items-center gap-1 px-2 py-1 hover:text-[#EEEEEE]" onClick={() => setCurrentId(rootId)}>
            <FolderTree className="size-3.5" aria-hidden />
            Technology Web
          </button>
          {path.filter((f) => f.id !== rootId).map((folder) => (
            <span key={folder.id} className="flex items-center gap-1">
              <ChevronRight className="size-3.5" aria-hidden />
              <button className="px-1 py-1 hover:text-[#EEEEEE]" onClick={() => setCurrentId(folder.id)}>{folder.name}</button>
            </span>
          ))}
        </div>

        <form onSubmit={submitNewFolder} className="mb-4 flex flex-wrap gap-2">
          <input
            className="focus-ring glass-input min-w-0 flex-1 border border-[#4C0033] px-3 py-2 text-sm text-[#EEEEEE]"
            placeholder="New folder name (semester, subject, or custom)"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
          />
          <button className="focus-ring flex items-center gap-2 bg-[#4C0033] px-4 py-2 text-sm font-semibold text-[#EEEEEE] hover:bg-[#650044]" type="submit">
            <FolderPlus className="size-4" aria-hidden />
            Add Folder
          </button>
        </form>

        {children.length === 0 && files.length === 0 && <Empty label="This folder is empty — add a subfolder or upload files into it" />}

        {children.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {children.map((folder, index) => (
              <div key={folder.id} className="folder-tile card-enter glass-raised group relative flex items-center gap-3 border border-[#4C0033]/50 p-3" style={{ animationDelay: `${index * 30}ms` }}>
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setCurrentId(folder.id)}>
                  <FolderIcon className="size-6 shrink-0 text-[#EEEEEE]" aria-hidden />
                  <span className="min-w-0 truncate text-sm">{folder.name}</span>
                </button>
                <button
                  className="focus-ring shrink-0 p-1.5 text-[#DDDDDD] opacity-60 hover:text-[#EEEEEE] hover:opacity-100"
                  aria-label={`Delete folder ${folder.name}`}
                  onClick={() => setConfirmTarget(folder)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {files.length > 0 && (
        <FileManager title="Files in this folder" files={files} view={view} setView={setView} sort={sort} setSort={setSort} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} hidePanelWhenEmpty />
      )}

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title="Delete this folder?"
        message={`"${confirmTarget?.name}" and every subfolder inside it will be permanently removed. Files inside will be kept and moved back to All Files. This cannot be undone.`}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={async () => {
          if (confirmTarget) await deleteFolder(confirmTarget.id, confirmTarget.name);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}

function FileManager({ title, files, view, setView, sort, setSort, mutateFile, downloadFile, deleteFile, hidePanelWhenEmpty }: {
  title?: string;
  files: SafeFileRecord[];
  view: "grid" | "table";
  setView: (view: "grid" | "table") => void;
  sort: string;
  setSort: (sort: string) => void;
  mutateFile: (file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) => Promise<void>;
  downloadFile: (file: SafeFileRecord) => Promise<void>;
  deleteFile: (file: SafeFileRecord, permanent?: boolean) => Promise<void>;
  hidePanelWhenEmpty?: boolean;
}) {
  if (hidePanelWhenEmpty && files.length === 0) return null;
  return (
    <Panel title={title ?? "File Manager"} actions={(
      <div className="flex items-center gap-2">
        <select className="focus-ring border border-[#4C0033] bg-black/60 px-2 py-1 text-xs text-[#EEEEEE]" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
          <option value="largest">Largest</option>
          <option value="smallest">Smallest</option>
        </select>
        <button className={clsx("focus-ring p-2 hover:text-[#EEEEEE]", view === "grid" && "text-[#EEEEEE]")} aria-label="Grid view" onClick={() => setView("grid")}><Grid3X3 className="size-4" /></button>
        <button className={clsx("focus-ring p-2 hover:text-[#EEEEEE]", view === "table" && "text-[#EEEEEE]")} aria-label="Table view" onClick={() => setView("table")}><List className="size-4" /></button>
      </div>
    )}>
      {files.length === 0 && <Empty label="No files match this view" />}
      {view === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {files.map((file, index) => <FileCard key={file.id} file={file} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} delayMs={index * 30} />)}
        </div>
      ) : (
        <FileRows files={files} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} />
      )}
    </Panel>
  );
}

// Mirrors src/lib/file-policy.ts#isPreviewSafe — only request /preview for types the API will actually stream back.
function isPreviewSafe(mimeType: string) {
  return (
    (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("audio/") ||
    ["video/mp4", "video/webm", "video/ogg"].includes(mimeType)
  );
}

function FileThumbnail({ file }: { file: SafeFileRecord }) {
  const Icon = categoryIcons[file.category] ?? FileText;
  const [errored, setErrored] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const canPreview = !file.deletedAt && !!file.telegramFileId && isPreviewSafe(file.mimeType) && !errored;
  const src = `/api/files/${file.id}/preview`;

  useEffect(() => {
    if (!ref.current || visible) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisible(true); },
      { rootMargin: "200px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  if (!canPreview) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-black/60">
        <Icon className="size-8 text-[#EEEEEE]" aria-hidden />
      </div>
    );
  }
  if (file.mimeType.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- authenticated route, next/image remote loader would need extra config
      <img src={src} alt={file.displayName} loading="lazy" decoding="async" className="aspect-video w-full bg-black/60 object-cover transition-transform duration-300 group-hover:scale-[1.03]" onError={() => setErrored(true)} />
    );
  }
  if (file.mimeType.startsWith("video/")) {
    return (
      <div ref={ref} className="aspect-video w-full bg-black/60">
        {visible && <video src={src} controls preload="metadata" className="size-full object-cover" onError={() => setErrored(true)} />}
      </div>
    );
  }
  if (file.mimeType.startsWith("audio/")) {
    return (
      <div ref={ref} className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-black/60 px-3">
        <Icon className="size-6 text-[#EEEEEE]" aria-hidden />
        {visible && <audio src={src} controls preload="metadata" className="w-full" onError={() => setErrored(true)} />}
      </div>
    );
  }
  // application/pdf, text/* — still not a great thumbnail, keep the icon tile.
  return (
    <div className="flex aspect-video w-full items-center justify-center bg-black/60">
      <Icon className="size-8 text-[#EEEEEE]" aria-hidden />
    </div>
  );
}

function FileCard({ file, mutateFile, downloadFile, deleteFile, delayMs }: {
  file: SafeFileRecord;
  mutateFile: (file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) => Promise<void>;
  downloadFile: (file: SafeFileRecord) => Promise<void>;
  deleteFile: (file: SafeFileRecord, permanent?: boolean) => Promise<void>;
  delayMs?: number;
}) {
  return (
    <article className="glass-raised card-enter group overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.45)]" style={{ animationDelay: `${delayMs ?? 0}ms` }}>
      <div className="relative overflow-hidden">
        <FileThumbnail file={file} />
        <button className="focus-ring absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-[#DDDDDD] transition-transform duration-200 hover:scale-110" aria-label="Toggle favourite" onClick={() => mutateFile(file, { isFavourite: !file.isFavourite })}>
          <Heart className={clsx("size-4", file.isFavourite && "fill-[#EEEEEE] text-[#EEEEEE]")} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-11 break-words text-sm font-semibold">{file.displayName}</h3>
        <p className="mt-1 truncate text-xs text-[#DDDDDD]">{file.originalName}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#DDDDDD]">
          <span>{file.category}</span>
          <span>{bytes(file.fileSize)}</span>
          <span>{file.mimeType}</span>
          <span>{file.encryptionStatus ? "encrypted" : "plain"}</span>
        </div>
        <FileActions file={file} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} />
      </div>
    </article>
  );
}

function FileRows({ files, compact, mutateFile, downloadFile, deleteFile }: {
  files: SafeFileRecord[];
  compact?: boolean;
  mutateFile?: (file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) => Promise<void>;
  downloadFile?: (file: SafeFileRecord) => Promise<void>;
  deleteFile?: (file: SafeFileRecord, permanent?: boolean) => Promise<void>;
}) {
  if (!files.length) return <Empty label="No file records" />;
  return (
    <>
      <div className="space-y-3 md:hidden">
        {files.map((file, index) => (
          <article key={file.id} className="glass-raised card-enter p-4 shadow-[0_12px_30px_rgba(0,0,0,0.45)]" style={{ animationDelay: `${index * 25}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-[#EEEEEE]">{file.displayName}</h3>
                <p className="mt-1 text-xs text-[#DDDDDD]">{file.category} / {bytes(file.fileSize)}</p>
              </div>
              {!compact && <span className="shrink-0 text-xs text-[#DDDDDD]">{file.availability ?? file.uploadStatus}</span>}
            </div>
            {!compact && mutateFile && downloadFile && deleteFile && (
              <FileActions file={file} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} />
            )}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className={clsx("w-full text-left text-sm", !compact && "min-w-[720px]")}>
          <thead className="text-xs text-[#DDDDDD]">
            <tr className="border-b border-[#4C0033]">
              <th className="py-2">Name</th><th>Category</th><th>Size</th><th>Status</th>{!compact && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id} className="border-b border-[#4C0033]/50 transition-colors duration-150 hover:bg-[#4C0033]/15">
                <td className="max-w-72 truncate py-3">{file.displayName}</td>
                <td>{file.category}</td>
                <td>{bytes(file.fileSize)}</td>
                <td>{file.availability ?? file.uploadStatus}</td>
                {!compact && mutateFile && downloadFile && deleteFile && <td><FileActions file={file} mutateFile={mutateFile} downloadFile={downloadFile} deleteFile={deleteFile} inline /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FileActions({ file, mutateFile, downloadFile, deleteFile, inline }: {
  file: SafeFileRecord;
  mutateFile: (file: SafeFileRecord, patch: Partial<SafeFileRecord> & { restore?: boolean }) => Promise<void>;
  downloadFile: (file: SafeFileRecord) => Promise<void>;
  deleteFile: (file: SafeFileRecord, permanent?: boolean) => Promise<void>;
  inline?: boolean;
}) {
  return (
    <div className={clsx("flex flex-wrap gap-2", inline ? "" : "mt-4")}>
      <button className="focus-ring p-2 text-[#DDDDDD] hover:text-[#EEEEEE]" aria-label="Preview" onClick={() => window.open(`/api/files/${file.id}/preview`, "_blank")}><Eye className="size-4" /></button>
      <button className="focus-ring p-2 text-[#DDDDDD] hover:text-[#EEEEEE]" aria-label="Download" onClick={() => downloadFile(file)}><Download className="size-4" /></button>
      <button className="focus-ring p-2 text-[#DDDDDD] hover:text-[#EEEEEE]" aria-label="Rename display name" onClick={() => { const displayName = window.prompt("Display name", file.displayName); if (displayName) mutateFile(file, { displayName }); }}><Pencil className="size-4" /></button>
      <button className="focus-ring p-2 text-[#DDDDDD] hover:text-[#EEEEEE]" aria-label="Copy internal link" onClick={() => navigator.clipboard.writeText(`${location.origin}/?file=${file.id}`)}><Copy className="size-4" /></button>
      {file.deletedAt ? (
        <button className="focus-ring p-2 text-[#EEEEEE]" aria-label="Restore" onClick={() => mutateFile(file, { restore: true })}><RefreshCw className="size-4" /></button>
      ) : (
        <button className="focus-ring p-2 text-[#DDDDDD] hover:text-[#EEEEEE]" aria-label="Move to Trash" onClick={() => deleteFile(file)}><Trash2 className="size-4" /></button>
      )}
      {file.deletedAt && <button className="focus-ring p-2 text-[#EEEEEE]" aria-label="Permanent delete" onClick={() => deleteFile(file, true)}><X className="size-4" /></button>}
    </div>
  );
}

function Destinations({ csrf, refreshCsrf, runTelegramCheck, results, addLog }: {
  csrf: string;
  refreshCsrf: () => Promise<string>;
  runTelegramCheck: () => Promise<void>;
  results: unknown[];
  addLog: (message: string, level?: LogLine["level"]) => void;
}) {
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    api<{ destinations: Destination[] }>("/api/settings/telegram").then((data) => setDestinations(data.destinations)).catch(() => undefined);
  }, []);

  async function saveDestinations() {
    const token = csrf || await refreshCsrf();
    await api("/api/settings/telegram", {
      method: "PUT",
      headers: { "x-csrf-token": token },
      body: JSON.stringify({ destinations: destinations.filter((item) => item.chatId?.trim()).map((item) => ({ category: item.category, label: item.label, chatId: item.chatId })) }),
    });
    addLog("Telegram destination mapping updated", "success");
  }

  return (
    <Panel title="Telegram Destinations" actions={<div className="flex gap-2"><button className="focus-ring flex items-center gap-2 border border-[#4C0033] px-3 py-2 text-xs hover:bg-[#4C0033]/20" onClick={saveDestinations}><CheckCircle2 className="size-4" />Save</button><button className="focus-ring flex items-center gap-2 bg-[#4C0033] px-3 py-2 text-xs font-semibold text-[#EEEEEE] hover:bg-[#650044]" onClick={runTelegramCheck}><Bot className="size-4" />Test</button></div>}>
      <p className="mb-4 text-sm leading-6 text-[#DDDDDD]">Images, videos, audio, documents, archives, and other files route to separate private Telegram destinations. Bot tokens and full API URLs never render in the browser.</p>
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        {destinations.map((destination, index) => (
          <label key={destination.category} className="glass-raised block border border-[#4C0033]/50 p-3 text-xs text-[#DDDDDD]">
            {destination.label} chat ID
            <input
              className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]"
              placeholder={destination.chatIdPreview}
              value={destination.chatId ?? ""}
              onChange={(event) => setDestinations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, chatId: event.target.value } : item))}
            />
          </label>
        ))}
      </div>
      <pre className="max-h-96 overflow-auto border border-[#4C0033] bg-black/50 p-4 text-xs text-[#DDDDDD]">{JSON.stringify(results.length ? results : { status: "Run a health check to verify mappings" }, null, 2)}</pre>
    </Panel>
  );
}

function SettingsPanel({ csrf, refreshCsrf, addLog }: { csrf: string; refreshCsrf: () => Promise<string>; addLog: (message: string, level?: LogLine["level"]) => void }) {
  const [settings, setSettings] = useState({
    maxUploadSizeMb: 50,
    allowedMimeTypes: "",
    blockedMimeTypes: "",
    allowedExtensions: "",
    blockedExtensions: "exe,msi,bat,cmd,com,scr,dll,ps1,sh,jar",
    encryptionEnabled: false,
    chunkingEnabled: false,
  });

  useEffect(() => {
    api<{ settings: { maxUploadSizeMb: number; allowedMimeTypes: string[]; blockedMimeTypes: string[]; allowedExtensions: string[]; blockedExtensions: string[]; encryptionEnabled: boolean; chunkingEnabled: boolean } }>("/api/settings/security")
      .then((data) => setSettings({
        maxUploadSizeMb: data.settings.maxUploadSizeMb,
        allowedMimeTypes: data.settings.allowedMimeTypes.join(","),
        blockedMimeTypes: data.settings.blockedMimeTypes.join(","),
        allowedExtensions: data.settings.allowedExtensions.join(","),
        blockedExtensions: data.settings.blockedExtensions.join(","),
        encryptionEnabled: data.settings.encryptionEnabled,
        chunkingEnabled: data.settings.chunkingEnabled,
      }))
      .catch(() => undefined);
  }, []);

  async function saveSettings() {
    const token = csrf || await refreshCsrf();
    const split = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    await api("/api/settings/security", {
      method: "PUT",
      headers: { "x-csrf-token": token },
      body: JSON.stringify({
        maxUploadSizeMb: Number(settings.maxUploadSizeMb),
        allowedMimeTypes: split(settings.allowedMimeTypes),
        blockedMimeTypes: split(settings.blockedMimeTypes),
        allowedExtensions: split(settings.allowedExtensions),
        blockedExtensions: split(settings.blockedExtensions),
        encryptionEnabled: settings.encryptionEnabled,
        chunkingEnabled: settings.chunkingEnabled,
      }),
    });
    addLog("Security settings updated", "success");
  }

  return (
    <Panel title="Settings" actions={<button className="focus-ring flex items-center gap-2 bg-[#4C0033] px-3 py-2 text-xs font-semibold text-[#EEEEEE] hover:bg-[#650044]" onClick={saveSettings}><CheckCircle2 className="size-4" />Save</button>}>
      <div className="grid gap-3">
        <label className="block text-xs text-[#DDDDDD]">Maximum upload size MB<input className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]" type="number" value={settings.maxUploadSizeMb} onChange={(event) => setSettings({ ...settings, maxUploadSizeMb: Number(event.target.value) })} /></label>
        <label className="block text-xs text-[#DDDDDD]">Allowed MIME types<input className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]" value={settings.allowedMimeTypes} onChange={(event) => setSettings({ ...settings, allowedMimeTypes: event.target.value })} /></label>
        <label className="block text-xs text-[#DDDDDD]">Blocked MIME types<input className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]" value={settings.blockedMimeTypes} onChange={(event) => setSettings({ ...settings, blockedMimeTypes: event.target.value })} /></label>
        <label className="block text-xs text-[#DDDDDD]">Allowed extensions<input className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]" value={settings.allowedExtensions} onChange={(event) => setSettings({ ...settings, allowedExtensions: event.target.value })} /></label>
        <label className="block text-xs text-[#DDDDDD]">Blocked extensions<input className="focus-ring mt-2 w-full border border-[#4C0033] bg-black/50 px-3 py-2 text-[#EEEEEE]" value={settings.blockedExtensions} onChange={(event) => setSettings({ ...settings, blockedExtensions: event.target.value })} /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="glass-raised flex items-center gap-3 border border-[#4C0033]/50 p-4 text-sm"><input type="checkbox" checked={settings.encryptionEnabled} onChange={(event) => setSettings({ ...settings, encryptionEnabled: event.target.checked })} />AES-256-GCM encryption</label>
          <label className="glass-raised flex items-center gap-3 border border-[#4C0033]/50 p-4 text-sm"><input type="checkbox" checked={settings.chunkingEnabled} onChange={(event) => setSettings({ ...settings, chunkingEnabled: event.target.checked })} />Experimental chunking</label>
        </div>
        <div className="glass-raised border border-[#4C0033]/50 p-4 text-sm leading-6 text-[#DDDDDD]">Losing `FILE_ENCRYPTION_KEY` makes encrypted files unrecoverable. Chunking increases upload time, download time, and failure risk.</div>
      </div>
    </Panel>
  );
}

function ActivityPanel() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  useEffect(() => {
    api<{ logs: ActivityLog[] }>("/api/activity").then((data) => setLogs(data.logs)).catch(() => undefined);
  }, []);
  return (
    <Panel title="Activity Log">
      <div className="space-y-2">
        {logs.length === 0 && <Empty label="No audit events recorded" />}
        {logs.map((log, index) => (
          <div key={log.id} className="glass-raised card-enter p-3 text-sm" style={{ animationDelay: `${index * 20}ms` }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#EEEEEE]">{log.action}</span>
              <span className="text-xs text-[#DDDDDD]">{new Date(log.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-xs text-[#DDDDDD]">Target: {log.targetId ?? "system"} / IP: {log.ipAddress ?? "not captured"}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TerminalPanel({ logs }: { logs: LogLine[] }) {
  return (
    <aside className="glass-panel min-h-96">
      <div className="flex items-center justify-between border-b border-[#4C0033] px-4 py-3">
        <div className="flex items-center gap-2"><Terminal className="size-4 text-[#EEEEEE]" /><h2 className="text-sm font-semibold">Terminal Activity Output</h2></div>
        <CheckCircle2 className="size-4 text-[#DDDDDD]" aria-hidden />
      </div>
      <div className="max-h-[calc(100vh-9rem)] space-y-2 overflow-auto p-4 text-xs leading-6">
        {logs.map((log, index) => (
          <p key={`${log.time}-${index}`} className={clsx(log.level === "success" && "text-[#EEEEEE]", log.level === "warning" && "text-[#DDDDDD]", log.level === "error" && "text-[#EEEEEE]", log.level === "info" && "text-[#DDDDDD]/80")}>
            [{log.time}] {log.message}
          </p>
        ))}
      </div>
    </aside>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-panel overflow-hidden shadow-[0_14px_36px_rgba(0,0,0,0.5)]">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#4C0033] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#EEEEEE]">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="glass-raised p-6 text-center text-sm text-[#DDDDDD]">{label}</div>;
}
