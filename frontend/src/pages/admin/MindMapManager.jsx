import { useEffect, useState } from "react";
import { GitBranch, Trash2 } from "lucide-react";

export default function MindMapManager() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/mindmaps", {
        cache: "no-store",
      });
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.message || "加载思维导图失败");
      setMaps(Array.isArray(data) ? data : []);
    } catch (error) {
      setNotice(error.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const remove = async (map) => {
    if (!window.confirm(`确定从后台删除“${map.title}”吗？删除后不可恢复。`))
      return;
    const response = await fetch(`/api/admin/mindmaps/${map.id}`, {
      method: "DELETE",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(data.message || "删除失败");
      return;
    }
    setMaps((items) => items.filter((item) => item.id !== map.id));
    setNotice("已删除");
  };
  return (
    <div>
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <GitBranch className="h-8 w-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            思维导图管理
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            管理站内思维导图。前台创建者只能修改自己的内容，删除操作仅在这里执行。
          </p>
        </div>
      </div>
      {notice && (
        <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200">
          {notice}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            加载中...
          </div>
        ) : maps.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            暂无思维导图
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {maps.map((map) => (
              <div key={map.id}>
                <div className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-gray-900 dark:text-slate-100">
                      {map.title}
                    </h2>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      创建者：{map.creatorEmail} · 版本 {map.version} · 更新于{" "}
                      {map.updatedAt
                        ? new Date(map.updatedAt).toLocaleString()
                        : "-"}
                    </p>
                    {map.description && (
                      <p className="mt-1 truncate text-sm text-gray-500">
                        {map.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => void remove(map)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    后台删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
