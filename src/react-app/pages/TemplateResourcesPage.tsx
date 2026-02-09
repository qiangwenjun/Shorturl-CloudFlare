// src/react-app/pages/TemplateResourcesPage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import {
    templateAssetsApi,
    PrefixInfo,
    TreeNode,
    TemplateAssetListItem,
} from "../lib/api";

type MessageType = "success" | "error" | "info";
interface Message {
    type: MessageType;
    text: string;
}

// ==================== 格式化工具 ====================
function formatSize(bytes: number | null): string {
    if (bytes == null || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
}
// ==================== 上传弹窗组件 ====================

const PART_SIZE = 10 * 1024 * 1024; // 10 MB per part
const DB_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const MULTIPART_THRESHOLD = 50 * 1024 * 1024; // 50 MB

interface UploadModalProps {
    defaultPrefix?: string;
    defaultDirectory?: string;
    onClose: () => void;
    onSuccess: () => void;
    showMessage: (type: MessageType, text: string) => void;
}

function UploadModal({ defaultPrefix, defaultDirectory, onClose, onSuccess, showMessage }: UploadModalProps) {
    const [prefix, setPrefix] = useState(defaultPrefix || "");
    const [filename, setFilename] = useState("");
    const [storageType, setStorageType] = useState<"r2" | "db">("r2");
    const [isPublic, setIsPublic] = useState(0);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        // 自动填入文件名（保留用户自定义目录前缀）
        const dir = defaultDirectory ? defaultDirectory + "/" : "";
        setFilename(dir + f.name);
    };

    const handleUpload = async () => {
        if (!file || !prefix.trim() || !filename.trim()) {
            showMessage("error", "请填写 prefix、filename 并选择文件");
            return;
        }

        // 检查数据库上传 2MB 限制
        if (storageType === "db" && file.size > DB_MAX_SIZE) {
            showMessage("error", "上传到数据库的文件不能超过 2 MB，请选择 R2 存储");
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            const cleanFilename = filename.replace(/^\/+|\/+$/g, "");

            if (storageType === "db") {
                await templateAssetsApi.uploadToDb(file, prefix.trim(), cleanFilename, isPublic);
                setProgress(100);
                showMessage("success", "上传成功（数据库存储）");
            } else if (file.size >= MULTIPART_THRESHOLD) {
                // 分片上传
                const createRes = await templateAssetsApi.multipartCreate(
                    prefix.trim(),
                    cleanFilename,
                    file.type || undefined
                );
                if (createRes.data.code !== 0) throw new Error(createRes.data.message);

                const { uploadId, r2Key } = createRes.data.data;
                const totalParts = Math.ceil(file.size / PART_SIZE);
                const parts: { partNumber: number; etag: string }[] = [];

                for (let i = 0; i < totalParts; i++) {
                    const start = i * PART_SIZE;
                    const end = Math.min(start + PART_SIZE, file.size);
                    const chunk = await file.slice(start, end).arrayBuffer();

                    const partRes = await templateAssetsApi.multipartUploadPart(
                        r2Key, uploadId, i + 1, chunk
                    );
                    if (partRes.data.code !== 0) throw new Error(partRes.data.message);

                    parts.push(partRes.data.data);
                    setProgress(Math.round(((i + 1) / totalParts) * 95));
                }

                const completeRes = await templateAssetsApi.multipartComplete({
                    prefix: prefix.trim(),
                    filename: cleanFilename,
                    r2Key,
                    uploadId,
                    parts,
                    size: file.size,
                    content_type: file.type || undefined,
                    is_public: isPublic,
                });
                if (completeRes.data.code !== 0) throw new Error(completeRes.data.message);

                setProgress(100);
                showMessage("success", "分片上传完成（R2 存储）");
            } else {
                // 普通 R2 上传
                await templateAssetsApi.uploadToR2(file, prefix.trim(), cleanFilename, isPublic);
                setProgress(100);
                showMessage("success", "上传成功（R2 存储）");
            }

            onSuccess();
            onClose();
        } catch (error: unknown) {
            const msg = error && typeof error === "object" && "response" in error
                ? (error.response as { data?: { message?: string } })?.data?.message || "上传失败"
                : error instanceof Error ? error.message : "上传失败";
            showMessage("error", msg);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg">
                <h3 className="font-bold text-lg mb-6">上传资源文件</h3>

                <div className="space-y-4">
                    {/* Prefix */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Prefix <span className="text-error">*</span></span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder="例如: my-template"
                            value={prefix}
                            onChange={(e) => setPrefix(e.target.value)}
                            disabled={!!defaultPrefix || uploading}
                        />
                    </div>

                    {/* 文件选择 */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">选择文件 <span className="text-error">*</span></span>
                        </label>
                        <input
                            type="file"
                            className="file-input file-input-bordered w-full"
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                        {file && (
                            <label className="label">
                                <span className="label-text-alt text-gray-500">
                                    大小: {formatSize(file.size)}
                                    {file.size >= MULTIPART_THRESHOLD && " (将使用分片上传)"}
                                </span>
                            </label>
                        )}
                    </div>

                    {/* Filename */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Filename <span className="text-error">*</span></span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder="例如: css/style.css"
                            value={filename}
                            onChange={(e) => setFilename(e.target.value)}
                            disabled={uploading}
                        />
                        <label className="label">
                            <span className="label-text-alt text-gray-500">支持目录路径，如 images/logo.png</span>
                        </label>
                    </div>

                    {/* 存储方式 */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">存储方式</span>
                        </label>
                        <div className="flex gap-4">
                            <label className="label cursor-pointer gap-2">
                                <input
                                    type="radio"
                                    name="storageType"
                                    className="radio radio-primary"
                                    checked={storageType === "r2"}
                                    onChange={() => setStorageType("r2")}
                                    disabled={uploading}
                                />
                                <span className="label-text">R2 存储</span>
                            </label>
                            <label className="label cursor-pointer gap-2">
                                <input
                                    type="radio"
                                    name="storageType"
                                    className="radio radio-primary"
                                    checked={storageType === "db"}
                                    onChange={() => setStorageType("db")}
                                    disabled={uploading || (file != null && file.size > DB_MAX_SIZE)}
                                />
                                <span className={`label-text ${file && file.size > DB_MAX_SIZE ? "text-gray-400" : ""}`}>
                                    数据库存储
                                    {file && file.size > DB_MAX_SIZE && " (文件超过 2MB)"}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* 公开访问 */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-3">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={isPublic === 1}
                                onChange={(e) => setIsPublic(e.target.checked ? 1 : 0)}
                                disabled={uploading}
                            />
                            <span className="label-text">公开访问</span>
                        </label>
                    </div>

                    {/* 上传进度 */}
                    {uploading && (
                        <div className="w-full">
                            <progress
                                className="progress progress-primary w-full"
                                value={progress}
                                max="100"
                            />
                            <p className="text-sm text-center mt-1 text-gray-500">{progress}%</p>
                        </div>
                    )}
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>
                        取消
                    </button>
                    <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !file}>
                        {uploading ? (
                            <>
                                <span className="loading loading-spinner loading-sm" />
                                上传中...
                            </>
                        ) : (
                            "上传"
                        )}
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={() => !uploading && onClose()} />
        </div>
    );
}

// ==================== 树节点渲染组件 ====================

interface TreeViewProps {
    nodes: TreeNode[];
    onDownload: (asset: TemplateAssetListItem) => void;
    onDelete: (asset: TemplateAssetListItem) => void;
    level?: number;
}

function TreeView({ nodes, onDownload, onDelete, level = 0 }: TreeViewProps) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggle = (path: string) => {
        setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
    };

    if (!nodes.length) {
        return level === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无文件</p>
        ) : null;
    }

    // 排序：文件夹在前，文件在后
    const sorted = [...nodes].sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <ul className={`${level > 0 ? "ml-5 border-l border-base-300 pl-3" : ""}`}>
            {sorted.map((node) => (
                <li key={node.path} className="py-0.5">
                    {node.type === "folder" ? (
                        <>
                            <button
                                className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-base-200 w-full text-left transition-colors"
                                onClick={() => toggle(node.path)}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className={`h-4 w-4 transition-transform ${expanded[node.path] ? "rotate-90" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <span className="font-medium">{node.name}</span>
                            </button>
                            {expanded[node.path] && node.children && (
                                <TreeView
                                    nodes={node.children}
                                    onDownload={onDownload}
                                    onDelete={onDelete}
                                    level={level + 1}
                                />
                            )}
                        </>
                    ) : (
                        <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-base-200 group transition-colors">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                <span className="truncate">{node.name}</span>
                                <span className="text-xs text-gray-400 shrink-0">
                                    {formatSize(node.asset?.size ?? null)}
                                </span>
                                <span className={`badge badge-xs ${node.asset?.storage_type === 1 ? "badge-primary" : "badge-secondary"}`}>
                                    {node.asset?.storage_type === 1 ? "R2" : "DB"}
                                </span>
                                {node.asset?.is_public === 1 && (
                                    <span className="badge badge-xs badge-success">公开</span>
                                )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {node.asset && (
                                    <>
                                        <button
                                            className="btn btn-xs btn-ghost"
                                            title="下载"
                                            onClick={() => onDownload(node.asset!)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                        <button
                                            className="btn btn-xs btn-ghost text-error"
                                            title="删除"
                                            onClick={() => onDelete(node.asset!)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
}

// ==================== 主页面组件 ====================

export function TemplateResourcesPage() {
    // 视图状态：prefix 列表 or prefix 详情
    const [currentPrefix, setCurrentPrefix] = useState<string | null>(null);

    // Prefix 列表
    const [prefixes, setPrefixes] = useState<PrefixInfo[]>([]);
    const [prefixLoading, setPrefixLoading] = useState(false);

    // 树数据
    const [tree, setTree] = useState<TreeNode[]>([]);
    const [treeTotal, setTreeTotal] = useState(0);
    const [treeLoading, setTreeLoading] = useState(false);

    // 上传弹窗
    const [showUpload, setShowUpload] = useState(false);
    const [uploadDirectory, setUploadDirectory] = useState("");

    // 删除确认
    const [deletingAsset, setDeletingAsset] = useState<TemplateAssetListItem | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // 删除整个 prefix
    const [deletingPrefix, setDeletingPrefix] = useState<PrefixInfo | null>(null);
    const [deletePrefixLoading, setDeletePrefixLoading] = useState(false);

    // 消息
    const [message, setMessage] = useState<Message | null>(null);
    const messageTimer = useRef<number>(0);

    const showMessage = useCallback((type: MessageType, text: string) => {
        clearTimeout(messageTimer.current);
        setMessage({ type, text });
        messageTimer.current = window.setTimeout(() => setMessage(null), 5000);
    }, []);

    // 加载 prefix 列表
    const loadPrefixes = useCallback(async () => {
        try {
            setPrefixLoading(true);
            const res = await templateAssetsApi.getPrefixes();
            if (res.data.code === 0) {
                setPrefixes(res.data.data.prefixes);
            } else {
                showMessage("error", res.data.message);
            }
        } catch {
            showMessage("error", "加载 prefix 列表失败");
        } finally {
            setPrefixLoading(false);
        }
    }, [showMessage]);

    // 加载树
    const loadTree = useCallback(async (prefix: string) => {
        try {
            setTreeLoading(true);
            const res = await templateAssetsApi.getTree(prefix);
            if (res.data.code === 0) {
                setTree(res.data.data.tree);
                setTreeTotal(res.data.data.total);
            } else {
                showMessage("error", res.data.message);
            }
        } catch {
            showMessage("error", "加载文件树失败");
        } finally {
            setTreeLoading(false);
        }
    }, [showMessage]);

    useEffect(() => {
        if (currentPrefix === null) {
            loadPrefixes();
        } else {
            loadTree(currentPrefix);
        }
    }, [currentPrefix, loadPrefixes, loadTree]);

    // 下载
    const handleDownload = async (asset: TemplateAssetListItem) => {
        try {
            const res = await templateAssetsApi.download(asset.id);
            const blob = new Blob([res.data]);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = asset.filename.split("/").pop() || asset.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            showMessage("error", "下载失败");
        }
    };

    // 删除
    const handleDelete = async () => {
        if (!deletingAsset) return;
        try {
            setDeleteLoading(true);
            const res = await templateAssetsApi.delete(deletingAsset.id);
            if (res.data.code === 0) {
                showMessage("success", "删除成功");
                setDeletingAsset(null);
                if (currentPrefix) loadTree(currentPrefix);
            } else {
                showMessage("error", res.data.message);
            }
        } catch {
            showMessage("error", "删除失败");
        } finally {
            setDeleteLoading(false);
        }
    };

    // 进入 prefix 详情
    const enterPrefix = (prefix: string) => {
        setCurrentPrefix(prefix);
    };

    // 返回 prefix 列表
    const goBack = () => {
        setCurrentPrefix(null);
        setTree([]);
        setTreeTotal(0);
    };

    // 删除整个 prefix
    const handleDeletePrefix = async () => {
        if (!deletingPrefix) return;
        try {
            setDeletePrefixLoading(true);
            const res = await templateAssetsApi.deleteByPrefix(deletingPrefix.asset_prefix);
            if (res.data.code === 0) {
                showMessage("success", `已删除 "${deletingPrefix.asset_prefix}" 下的所有资源`);
                setDeletingPrefix(null);
                // 如果当前正在查看该 prefix 的详情，则返回列表
                if (currentPrefix === deletingPrefix.asset_prefix) {
                    goBack();
                }
                loadPrefixes();
            } else {
                showMessage("error", res.data.message);
            }
        } catch {
            showMessage("error", "删除 prefix 失败");
        } finally {
            setDeletePrefixLoading(false);
        }
    };

    // 打开上传弹窗
    const openUpload = (directory?: string) => {
        setUploadDirectory(directory || "");
        setShowUpload(true);
    };

    return (
        <div className="p-6">
            {/* 消息提示 */}
            {message && (
                <div className="toast toast-top toast-center z-50">
                    <div className={`alert ${
                        message.type === "success" ? "alert-success" :
                            message.type === "error" ? "alert-error" : "alert-info"
                    } shadow-lg`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            {message.type === "success" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : message.type === "error" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                        </svg>
                        <span>{message.text}</span>
                    </div>
                </div>
            )}

            {/* ========= Prefix 列表视图 ========= */}
            {currentPrefix === null ? (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold">模板资源管理</h1>
                            <p className="text-sm text-gray-500 mt-1">共 {prefixes.length} 个资源组</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => openUpload()}>
                            + 上传资源
                        </button>
                    </div>

                    {prefixLoading ? (
                        <div className="flex justify-center py-16">
                            <span className="loading loading-spinner loading-lg" />
                        </div>
                    ) : prefixes.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <p className="text-lg">暂无资源，点击上方按钮上传</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {prefixes.map((p) => (
                                <div
                                    key={p.asset_prefix}
                                    className="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer border border-base-300 group"
                                    onClick={() => enterPrefix(p.asset_prefix)}
                                >
                                    <div className="card-body py-5">
                                        <div className="flex items-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                            <div className="min-w-0 flex-1">
                                                <h2 className="card-title text-base truncate" title={p.asset_prefix}>
                                                    {p.asset_prefix}
                                                </h2>
                                                <p className="text-sm text-gray-500">
                                                    {p.file_count} 个文件 · {formatSize(p.total_size)}
                                                </p>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm text-error opacity-0 group-hover:opacity-100 hover:bg-error/10"
                                                title="删除整个 prefix"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeletingPrefix(p);
                                                }}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                /* ========= Prefix 详情视图（树结构） ========= */
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <button className="btn btn-ghost btn-sm" onClick={goBack}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                返回
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold font-mono">{currentPrefix}</h1>
                                <p className="text-sm text-gray-500 mt-0.5">共 {treeTotal} 个文件</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-error btn-outline"
                                onClick={() => {
                                    const info = prefixes.find(p => p.asset_prefix === currentPrefix);
                                    setDeletingPrefix(info || {
                                        asset_prefix: currentPrefix,
                                        file_count: treeTotal,
                                        total_size: null,
                                    });
                                }}
                            >
                                删除全部
                            </button>
                            <button className="btn btn-primary" onClick={() => openUpload()}>
                                + 上传资源
                            </button>
                        </div>
                    </div>

                    <div className="bg-base-100 rounded-lg shadow border border-base-300 p-4 min-h-[300px]">
                        {treeLoading ? (
                            <div className="flex justify-center py-16">
                                <span className="loading loading-spinner loading-lg" />
                            </div>
                        ) : (
                            <TreeView
                                nodes={tree}
                                onDownload={handleDownload}
                                onDelete={setDeletingAsset}
                            />
                        )}
                    </div>
                </>
            )}

            {/* 上传弹窗 */}
            {showUpload && (
                <UploadModal
                    defaultPrefix={currentPrefix || undefined}
                    defaultDirectory={uploadDirectory}
                    onClose={() => setShowUpload(false)}
                    onSuccess={() => {
                        if (currentPrefix) {
                            loadTree(currentPrefix);
                        } else {
                            loadPrefixes();
                        }
                    }}
                    showMessage={showMessage}
                />
            )}

            {/* 删除确认弹窗 */}
            {deletingAsset && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">确认删除</h3>
                        <p className="py-2">
                            确定要删除文件 <span className="font-mono font-bold">"{deletingAsset.filename}"</span> 吗？
                        </p>
                        <p className="text-sm text-gray-500">
                            存储类型: {deletingAsset.storage_type === 1 ? "R2" : "数据库"} · 大小: {formatSize(deletingAsset.size)}
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setDeletingAsset(null)}
                                disabled={deleteLoading}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={handleDelete}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? (
                                    <>
                                        <span className="loading loading-spinner loading-sm" />
                                        删除中...
                                    </>
                                ) : (
                                    "确认删除"
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => !deleteLoading && setDeletingAsset(null)} />
                </div>
            )}

            {/* 删除 prefix 确认弹窗 */}
            {deletingPrefix && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4 text-error">⚠️ 删除整个资源组</h3>
                        <p className="py-2">
                            确定要删除资源组 <span className="font-mono font-bold">"{deletingPrefix.asset_prefix}"</span> 下的所有文件吗？
                        </p>
                        <p className="text-sm text-gray-500">
                            共 {deletingPrefix.file_count} 个文件
                            {deletingPrefix.total_size != null && ` · 总大小: ${formatSize(deletingPrefix.total_size)}`}
                        </p>
                        <p className="text-sm text-error mt-2">此操作不可恢复！</p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setDeletingPrefix(null)}
                                disabled={deletePrefixLoading}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={handleDeletePrefix}
                                disabled={deletePrefixLoading}
                            >
                                {deletePrefixLoading ? (
                                    <>
                                        <span className="loading loading-spinner loading-sm" />
                                        删除中...
                                    </>
                                ) : (
                                    "确认删除全部"
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => !deletePrefixLoading && setDeletingPrefix(null)} />
                </div>
            )}
        </div>
    );
}