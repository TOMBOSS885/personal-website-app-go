import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Redo2,
  Save,
  Search,
  StickyNote,
  Undo2,
  X,
} from "lucide-react";
import { useUserAuth } from "../contexts/UserAuthContext";
import DropdownSelect from "../components/DropdownSelect";

const EMPTY = {
  nodes: [
    {
      id: "root",
      parentId: null,
      text: "中心主题",
      x: 420,
      y: 260,
      collapsed: false,
      note: "",
      color: "#dbeafe",
      projectId: null,
      articleId: null,
      articleHeadingId: "",
      articleHeadingText: "",
    },
  ],
  viewport: { x: 0, y: 0, scale: 1 },
};
const colors = [
  "#dbeafe",
  "#dcfce7",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#cffafe",
];
const uid = () =>
  `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const copy = (value) => JSON.parse(JSON.stringify(value));
const children = (nodes, id) => nodes.filter((node) => node.parentId === id);
function headings(content) {
  const seen = {};
  return String(content || "")
    .split(/\r?\n/)
    .map((line, index) => {
      const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (!m) return null;
      const text = m[2].replace(/[*_`~\[\]]/g, "").trim();
      const base =
        text
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-+|-+$/g, "") || "section";
      seen[base] = (seen[base] || 0) + 1;
      return {
        id: seen[base] > 1 ? `${base}-${seen[base]}` : base,
        text,
        level: m[1].length,
        line: index + 1,
      };
    })
    .filter(Boolean);
}

export default function MindMapsPage() {
  const { user, loading: authLoading } = useUserAuth();
  const [params, setParams] = useSearchParams();
  const [maps, setMaps] = useState([]);
  const [mapQuery, setMapQuery] = useState("");
  const [resources, setResources] = useState({ projects: [], articles: [] });
  const [map, setMap] = useState(null);
  const [data, setData] = useState(EMPTY);
  const [selectedId, setSelectedId] = useState("root");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [articleHeadings, setArticleHeadings] = useState([]);
  const [projectQuery, setProjectQuery] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [mode, setMode] = useState("list");
  const [fullscreen, setFullscreen] = useState(false);
  const drag = useRef(null);
  const timer = useRef(null);
  const editorRef = useRef(null);
  const canUse = Boolean(user?.hasOAuthIdentity);
  const canEdit = mode === "edit" && (!map?.id || Number(map.creatorId) === Number(user?.id));
  const selected = data.nodes.find((node) => node.id === selectedId);
  const filteredMaps = useMemo(() => {
    const query = mapQuery.trim().toLocaleLowerCase();
    if (!query) return maps;
    return maps.filter((item) => `${item.title || ""} ${item.description || ""} ${item.creatorEmail || ""}`.toLocaleLowerCase().includes(query));
  }, [mapQuery, maps]);
  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLocaleLowerCase();
    const matches = resources.projects.filter((project) =>
      !query || `${project.name || ""} ${project.description || ""} ${project.techStack || ""}`.toLocaleLowerCase().includes(query),
    );
    if (selected?.projectId && !matches.some((project) => Number(project.id) === Number(selected.projectId))) {
      const current = resources.projects.find((project) => Number(project.id) === Number(selected.projectId));
      if (current) return [current, ...matches];
    }
    return matches;
  }, [projectQuery, resources.projects, selected?.projectId]);
  const filteredArticles = useMemo(() => {
    const query = articleQuery.trim().toLocaleLowerCase();
    const matches = resources.articles.filter((article) =>
      !query || `${article.title || ""} ${article.summary || ""}`.toLocaleLowerCase().includes(query),
    );
    if (selected?.articleId && !matches.some((article) => Number(article.id) === Number(selected.articleId))) {
      const current = resources.articles.find((article) => Number(article.id) === Number(selected.articleId));
      if (current) return [current, ...matches];
    }
    return matches;
  }, [articleQuery, resources.articles, selected?.articleId]);
  const byId = useMemo(
    () => Object.fromEntries(data.nodes.map((node) => [node.id, node])),
    [data.nodes],
  );
  const visible = useMemo(() => {
    const hidden = new Set();
    const walk = (id) =>
      children(data.nodes, id).forEach((child) => {
        hidden.add(child.id);
        if (!byId[id]?.collapsed) walk(child.id);
      });
    data.nodes
      .filter((node) => node.collapsed)
      .forEach((node) => walk(node.id));
    return data.nodes.filter((node) => !hidden.has(node.id));
  }, [data.nodes, byId]);
  const isDescendant = (candidateId, ancestorId) => {
    let parentId = byId[candidateId]?.parentId;
    while (parentId) {
      if (parentId === ancestorId) return true;
      parentId = byId[parentId]?.parentId;
    }
    return false;
  };
  const open = useCallback(
    async (id, nextMode = "view") => {
      const response = await fetch(`/api/public/mindmaps/${id}`, {
        cache: "no-store",
      });
      const detail = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(detail.message || "加载失败");
      setMap(detail);
      setData(detail.data || EMPTY);
      setSelectedId(detail.data?.nodes?.[0]?.id || "root");
      setDirty(false);
      setPast([]);
      setFuture([]);
      setMode(nextMode);
      setParams({ id: String(id), ...(nextMode === "edit" ? { edit: "1" } : {}) });
    },
    [setParams],
  );
  useEffect(() => {
    if (authLoading || !canUse) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/public/mindmaps"),
          fetch("/api/public/mindmap-resources"),
        ]);
        const list = await a.json();
        const res = await b.json();
        setMaps(Array.isArray(list) ? list : []);
        setResources({
          projects: res.projects || [],
          articles: res.articles || [],
        });
        const wanted = Number(params.get("id"));
        const selectedMap = (Array.isArray(list) ? list : []).find((item) => item.id === wanted);
        if (selectedMap) await open(selectedMap.id, params.get("edit") === "1" ? "edit" : "view");
        else if (!params.get("edit")) setMode("list");
      } catch (error) {
        setNotice(error.message || "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [authLoading, canUse, open, params]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    setProjectQuery("");
    setArticleQuery("");
  }, [selectedId]);
  useEffect(() => {
    const handleFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);
  const commit = (next) => {
    if (!canEdit) return;
    setPast((items) => [...items.slice(-49), copy(data)]);
    setFuture([]);
    setData(next);
    setDirty(true);
  };
  const update = (id, patch) =>
    commit({
      ...data,
      nodes: data.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node,
      ),
    });
  const add = (parentId) => {
    const parent = byId[parentId] || data.nodes[0];
    const count = children(data.nodes, parent.id).length;
    const node = {
      id: uid(),
      parentId: parent.id,
      text: "新节点",
      x: parent.x + 220,
      y: parent.y + (count - 1) * 76,
      collapsed: false,
      note: "",
      color: colors[data.nodes.length % colors.length],
      projectId: null,
      articleId: null,
      articleHeadingId: "",
      articleHeadingText: "",
    };
    commit({ ...data, nodes: [...data.nodes, node] });
    setSelectedId(node.id);
  };
  const remove = (id) => {
    if (id === data.nodes[0]?.id) return;
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      data.nodes.forEach((node) => {
        if (removed.has(node.parentId) && !removed.has(node.id)) {
          removed.add(node.id);
          changed = true;
        }
      });
    }
    commit({
      ...data,
      nodes: data.nodes.filter((node) => !removed.has(node.id)),
    });
    setSelectedId(data.nodes.find((node) => !removed.has(node.id))?.id);
  };
  const save = useCallback(async () => {
    if (!canUse || !dirty) return;
    const title = String(map?.title || "").trim();
    if (!title) {
      setNotice("请先填写思维导图名称");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        map?.id ? `/api/public/mindmaps/${map.id}` : "/api/public/mindmaps",
        {
          method: map?.id ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": user?.csrfToken || "",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            title,
            description: map?.description || "",
            data,
          }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "保存失败");
      setMap(result);
      setData(result.data || data);
      setMaps((items) => [
        result,
        ...items.filter((item) => item.id !== result.id),
      ]);
      setDirty(false);
      setNotice("已保存");
      setMode("edit");
      setParams({ id: String(result.id), edit: "1" });
    } catch (error) {
      setNotice(error.message || "保存失败");
    } finally {
      setSaving(false);
    }
  }, [canUse, data, dirty, map, setParams, user?.csrfToken]);
  useEffect(() => {
    if (!dirty || (!map?.id && !String(map?.title || "").trim())) return;
    timer.current = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer.current);
  }, [dirty, save]);
  const startNew = () => {
    setMap({
      id: null,
      title: "",
      description: "",
      creatorId: user.id,
      creatorEmail: user.email,
    });
    setData(copy(EMPTY));
    setSelectedId("root");
    setPast([]);
    setFuture([]);
    setDirty(false);
    setMode("edit");
    setNotice("");
    setParams({ edit: "1" });
  };
  const backToList = () => {
    if (dirty && !window.confirm("当前有未保存修改，确定返回列表吗？")) return;
    setMode("list");
    setMap(null);
    setData(copy(EMPTY));
    setDirty(false);
    setPast([]);
    setFuture([]);
    setParams({});
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (editorRef.current?.requestFullscreen) await editorRef.current.requestFullscreen();
      else setFullscreen((value) => !value);
    } catch {
      setFullscreen((value) => !value);
    }
  };
  const pointerDown = (event, node) => {
    event.stopPropagation();
    if (!canEdit) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      type: "node",
      id: node.id,
      x: event.clientX,
      y: event.clientY,
      sx: node.x,
      sy: node.y,
    };
  };
  const canvasDown = (event) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      type: "canvas",
      x: event.clientX,
      y: event.clientY,
      sx: data.viewport.x,
      sy: data.viewport.y,
    };
  };
  const move = (event) => {
    const d = drag.current;
    if (!d) return;
    if (d.type === "node") {
      setData((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === d.id
            ? {
                ...node,
                x: d.sx + (event.clientX - d.x) / current.viewport.scale,
                y: d.sy + (event.clientY - d.y) / current.viewport.scale,
              }
            : node,
        ),
      }));
      if (canEdit) setDirty(true);
    } else {
      setData((current) => ({
        ...current,
        viewport: {
          ...current.viewport,
          x: d.sx + event.clientX - d.x,
          y: d.sy + event.clientY - d.y,
        },
      }));
      if (canEdit) setDirty(true);
    }
  };
  const chooseArticle = async (id) => {
    update(selectedId, {
      articleId: id ? Number(id) : null,
      articleHeadingId: "",
      articleHeadingText: "",
    });
    setArticleHeadings([]);
    if (!id) return;
    const response = await fetch(`/api/public/articles/${id}`);
    const article = await response.json().catch(() => ({}));
    if (response.ok) setArticleHeadings(headings(article.content));
  };
  const autoLayout = () => {
    const next = copy(data);
    const root = next.nodes[0];
    if (!root) return;
    const place = (id, depth, top) => {
      const kids = children(next.nodes, id);
      kids.forEach((node, index) => {
        node.x = root.x + depth * 230;
        node.y = top + index * 90;
        place(node.id, depth + 1, node.y);
      });
    };
    root.x = 120;
    root.y = 260;
    place(root.id, 1, 100);
    commit(next);
  };
  useEffect(() => {
    const keydown = (event) => {
      if (
        !canEdit ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      } else if (event.key === "Tab" && selectedId) {
        event.preventDefault();
        add(selectedId);
      } else if (event.key === "Delete" && selectedId) {
        event.preventDefault();
        remove(selectedId);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [canEdit, save, selectedId, data]);
  if (authLoading || loading)
    return (
      <div className="mx-auto flex min-h-[70vh] items-center justify-center text-gray-500">
        正在加载思维导图...
      </div>
    );
  if (!user)
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <GitBranch className="mx-auto h-14 w-14 text-indigo-500" />
        <h1 className="mt-5 text-2xl font-bold">请先登录</h1>
        <Link
          className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-white"
          to="/login"
        >
          前往登录
        </Link>
      </div>
    );
  if (!canUse)
    return (
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <GitBranch className="mx-auto h-14 w-14 text-amber-500" />
        <h1 className="mt-5 text-2xl font-bold">绑定第三方账号后即可使用</h1>
        <p className="mt-3 text-gray-500">
          请先在账号设置中绑定至少一个第三方账号。
        </p>
        <Link
          className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-white"
          to="/account"
        >
          前往账号设置
        </Link>
      </div>
    );
  if (mode === "list") {
    return (
      <div className="min-h-screen px-3 pb-12 pt-24 sm:px-6">
        <div className="mx-auto max-w-[1280px]">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <GitBranch className="h-8 w-8 text-indigo-500" />
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">思维导图</h1>
              </div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">浏览站内思维导图，点击卡片即可查看。</p>
            </div>
            <button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> 新建思维导图
            </button>
          </header>
          {notice && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">{notice}</p>}
          {maps.length > 0 && <div className="relative mb-5 max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={mapQuery} onChange={(event) => setMapQuery(event.target.value)} placeholder="搜索思维导图标题、描述或创建者" className="w-full rounded-xl border border-slate-200 bg-white/85 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100 dark:focus:ring-indigo-500/20" /></div>}
          {maps.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <GitBranch className="mx-auto h-12 w-12 text-slate-400" />
              <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">还没有思维导图</h2>
              <p className="mt-2 text-sm text-slate-500">创建第一张图，把想法整理成清晰结构。</p>
            </div>
          ) : (
            filteredMaps.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60">没有找到匹配的思维导图。</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMaps.map((item) => {
                const mine = Number(item.creatorId) === Number(user.id);
                return (
                  <article key={item.id} onClick={() => void open(item.id, "view")} className="group cursor-pointer rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900/85">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">{item.title || "未命名思维导图"}</h2>
                        <p className="mt-1 truncate text-xs text-slate-500">创建者：{item.creatorEmail}</p>
                      </div>
                      <GitBranch className="h-5 w-5 shrink-0 text-indigo-400" />
                    </div>
                    {item.description && <p className="mt-4 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>}
                    <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>更新于 {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-"}</span>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={(event) => { event.stopPropagation(); void open(item.id, "view"); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">查看</button>
                        {mine && <button onClick={(event) => { event.stopPropagation(); void open(item.id, "edit"); }} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 font-medium text-white hover:bg-indigo-700">编辑</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={`min-h-screen px-3 pb-8 pt-24 sm:px-6 ${fullscreen ? "pt-0" : ""}`}>
      <div ref={editorRef} className={`mx-auto max-w-[1500px] overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/80 ${fullscreen ? "fixed inset-0 z-[100] max-w-none rounded-none" : ""}`}>
        <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-800">
          <button onClick={backToList} className="tool-icon" title="返回思维导图列表" aria-label="返回思维导图列表"><ArrowLeft className="h-4 w-4" /></button>
          <GitBranch className="h-6 w-6 text-indigo-500" />
          <div className="mr-auto min-w-[220px]">
            <input
              value={map?.title || ""}
              readOnly={!canEdit}
              onChange={(e) => {
                setMap((current) => ({
                  ...(current || {}),
                  title: e.target.value,
                }));
                setDirty(true);
              }}
              className="w-full bg-transparent text-lg font-semibold outline-none dark:text-white"
              placeholder="请输入思维导图名称"
            />
            <p className="text-xs text-gray-500">
              创建者：{map?.creatorEmail || user.email} ·{" "}
              {dirty ? "有未保存修改" : notice || "已同步"}
            </p>
          </div>
          <button
            onClick={() => {
              if (past.length) {
                const previous = past[past.length - 1];
                setPast((items) => items.slice(0, -1));
                setFuture((items) => [copy(data), ...items]);
                setData(previous);
                setDirty(true);
              }
            }}
            className="tool-icon"
            disabled={!canEdit || !past.length}
            title="撤销"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (future.length) {
                const next = future[0];
                setFuture((items) => items.slice(1));
                setPast((items) => [...items, copy(data)]);
                setData(next);
                setDirty(true);
              }
            }}
            className="tool-icon"
            disabled={!canEdit || !future.length}
            title="重做"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button onClick={autoLayout} disabled={!canEdit} className="tool-icon" title="自动布局"><GitBranch className="h-4 w-4" /></button>
          <button onClick={() => void toggleFullscreen()} className="tool-icon" title={fullscreen ? "退出全屏" : "全屏查看"} aria-label={fullscreen ? "退出全屏" : "全屏查看"}>{fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          <button
            onClick={() => void save()}
            disabled={saving || !dirty || !canEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中" : "保存"}
          </button>
        </header>
        <div className="grid min-h-[680px] lg:grid-cols-[230px_minmax(480px,1fr)_280px]">
          <aside className="border-b border-gray-200 p-3 dark:border-slate-800 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold dark:text-slate-200">
                站内思维导图
              </h2>
              <button onClick={startNew} className="tool-icon" title="新建">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={startNew}
              className="mb-3 w-full rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm text-indigo-600"
            >
              新建思维导图
            </button>
            <div className="space-y-1">
              {maps.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void open(item.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm ${map?.id === item.id ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200" : "hover:bg-gray-100 dark:text-slate-300"}`}
                >
                  <span className="block truncate font-medium">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs opacity-60">
                    {item.creatorEmail}
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <section
            onPointerDown={canvasDown}
            onPointerMove={move}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            className="relative min-h-[560px] overflow-hidden bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#334155_1px,transparent_1px)]"
            style={{ touchAction: "none" }}
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-lg border bg-white/90 p-1 dark:border-slate-700 dark:bg-slate-900/90">
              <button
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    viewport: {
                      ...current.viewport,
                      scale: Math.max(0.2, current.viewport.scale - 0.1),
                    },
                  }))
                }
                className="tool-icon"
                title="缩小"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs text-gray-500">
                {Math.round(data.viewport.scale * 100)}%
              </span>
              <button
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    viewport: {
                      ...current.viewport,
                      scale: Math.min(2.5, current.viewport.scale + 0.1),
                    },
                  }))
                }
                className="tool-icon"
                title="放大"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    viewport: { x: 0, y: 0, scale: 1 },
                  }))
                }
                className="tool-icon"
                title="重置视图"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${data.viewport.x}px,${data.viewport.y}px) scale(${data.viewport.scale})`,
                transformOrigin: "0 0",
              }}
            >
              <svg className="pointer-events-none absolute left-0 top-0 h-[1000px] w-[1400px] overflow-visible">
                {visible
                  .filter((node) => node.parentId && byId[node.parentId])
                  .map((node) => {
                    const parent = byId[node.parentId];
                    return (
                      <path
                        key={node.id}
                        d={`M${parent.x + 180} ${parent.y + 30} C${parent.x + 220} ${parent.y + 30},${node.x - 40} ${node.y + 30},${node.x} ${node.y + 30}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                      />
                    );
                  })}
              </svg>
              {visible.map((node) => (
                <div
                  key={node.id}
                  onPointerDown={(e) => pointerDown(e, node)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(node.id);
                  }}
                  className={`absolute flex min-h-[60px] w-[180px] cursor-grab items-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${selectedId === node.id ? "ring-2 ring-indigo-500" : ""}`}
                  style={{
                    left: node.x,
                    top: node.y,
                    background: node.color || "#dbeafe",
                  }}
                >
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) update(node.id, { collapsed: !node.collapsed });
                    }}
                    className="shrink-0"
                  >
                    {children(data.nodes, node.id).length ? (
                      node.collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    ) : (
                      <span className="block h-4 w-4" />
                    )}
                  </button>
                  <span className="line-clamp-3 flex-1 text-sm font-medium text-slate-800">
                    {node.text}
                  </span>
                  {node.note && (
                    <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </div>
              ))}
            </div>
          </section>
          <aside className="border-t border-gray-200 p-4 dark:border-slate-800 lg:border-l lg:border-t-0">
            {selected ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold dark:text-slate-200">
                    节点属性
                  </h2>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="tool-icon"
                    title="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <label className="mb-3 block text-xs text-gray-500">
                  节点标题
                  <input
                    value={selected.text}
                    onChange={(e) => update(selected.id, { text: e.target.value })}
                    readOnly={!canEdit}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="mb-3 block text-xs text-gray-500">
                  所属父节点
                  <DropdownSelect
                    value={selected.parentId || ""}
                    onChange={(e) => update(selected.id, { parentId: e.target.value || null })}
                    disabled={!canEdit || selected.id === data.nodes[0]?.id}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    options={[{ value: "", label: "根节点" }, ...data.nodes.filter((node) => node.id !== selected.id && !isDescendant(node.id, selected.id)).map((node) => ({ value: node.id, label: node.text }))]}
                  />
                </label>
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => add(selected.id)}
                    disabled={!canEdit}
                    className="flex-1 rounded-lg bg-indigo-600 px-2 py-2 text-xs text-white"
                  >
                    <Plus className="mr-1 inline h-3.5 w-3.5" />
                    添加子节点
                  </button>
                  <button
                    onClick={() => remove(selected.id)}
                    disabled={!canEdit || selected.id === data.nodes[0]?.id}
                    className="rounded-lg border border-red-200 px-2 py-2 text-xs text-red-600 disabled:opacity-40"
                  >
                    删除节点
                  </button>
                </div>
                <label className="mb-3 block text-xs text-gray-500">
                  备注
                  <textarea
                    value={selected.note || ""}
                    onChange={(e) =>
                      update(selected.id, { note: e.target.value })
                    }
                    readOnly={!canEdit}
                    rows={4}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <label className="mb-3 block text-xs text-gray-500">
                  关联项目
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={projectQuery}
                      onChange={(event) => setProjectQuery(event.target.value)}
                      disabled={!canEdit}
                      placeholder="搜索项目名称或关键词"
                      className="w-full rounded-lg border bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <DropdownSelect
                    value={selected.projectId || ""}
                    onChange={(e) =>
                      update(selected.id, {
                        projectId: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    options={[{ value: "", label: "不关联" }, ...filteredProjects.map((project) => ({ value: project.id, label: project.name }))]}
                  />
                </label>
                <label className="mb-3 block text-xs text-gray-500">
                  关联文章
                  <div className="relative mt-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      value={articleQuery}
                      onChange={(event) => setArticleQuery(event.target.value)}
                      disabled={!canEdit}
                      placeholder="搜索文章标题或摘要"
                      className="w-full rounded-lg border bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                  <DropdownSelect
                    value={selected.articleId || ""}
                    onChange={(e) => void chooseArticle(e.target.value)}
                    disabled={!canEdit}
                    className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    options={[{ value: "", label: "不关联" }, ...filteredArticles.map((article) => ({ value: article.id, label: article.title }))]}
                  />
                </label>
                {selected.articleId && (
                  <label className="mb-3 block text-xs text-gray-500">
                    文章目录位置
                    <DropdownSelect
                      value={selected.articleHeadingId || ""}
                      onChange={(e) => {
                        const heading = articleHeadings.find(
                          (item) => item.id === e.target.value,
                        );
                        update(selected.id, {
                          articleHeadingId: e.target.value,
                          articleHeadingText: heading?.text || "",
                        });
                      }}
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      options={[{ value: "", label: "文章顶部" }, ...articleHeadings.map((item) => ({ value: item.id, label: `${"#".repeat(item.level)} ${item.text}` }))]}
                    />
                  </label>
                )}
                {selected.articleId && (
                  <Link
                    to={`/blog/${selected.articleId}${selected.articleHeadingId ? `#${selected.articleHeadingId}` : ""}`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    打开关联文章
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                {selected.projectId && (
                  <Link to={`/projects#project-${selected.projectId}`} className="ml-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                    打开关联项目 <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
                <div className="mt-4 flex gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => update(selected.id, { color })}
                      disabled={!canEdit}
                      aria-label={color}
                      className="h-6 w-6 rounded-full border-2 border-white shadow"
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">选择一个节点开始编辑</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
