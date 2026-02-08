import { useEffect, useState } from "react";
import { domainApi, Domain, CreateDomainRequest, UpdateDomainRequest } from "../lib/api";

type MessageType = 'success' | 'error' | 'info';

interface Message {
    type: MessageType;
    text: string;
}

export function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    // 消息提示状态
    const [message, setMessage] = useState<Message | null>(null);

    // 弹窗状态
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingDomain, setEditingDomain] = useState<Domain | null>(null);

    // 删除确认弹窗
    const [deletingDomain, setDeletingDomain] = useState<Domain | null>(null);

    // 表单数据
    const [formData, setFormData] = useState<CreateDomainRequest>({
        host: '',
        is_active: 1,
        is_default: 0,
        notes: '',
    });

    // 显示消息
    const showMessage = (type: MessageType, text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // 加载域名列表
    const loadDomains = async () => {
        try {
            setLoading(true);
            const res = await domainApi.getList(page, pageSize);
            if (res.data.code === 0) {
                // 按ID降序排序（最新的在前面）
                const sortedDomains = res.data.data.results.sort((a, b) => a.id - b.id);
                setDomains(sortedDomains);
                setTotal(res.data.data.pagination.total);
                setTotalPages(res.data.data.pagination.totalPages);
            }
        } catch (error) {
            console.error('加载域名列表失败:', error);
            showMessage('error', '加载域名列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDomains();
    }, [page]);

    // 打开创建弹窗
    const handleCreate = () => {
        setModalMode('create');
        setFormData({
            host: '',
            is_active: 1,
            is_default: 0,
            notes: '',
        });
        setShowModal(true);
    };

    // 打开编辑弹窗
    const handleEdit = (domain: Domain) => {
        setModalMode('edit');
        setEditingDomain(domain);
        setFormData({
            host: domain.host,
            is_active: domain.is_active,
            is_default: domain.is_default,
            notes: domain.notes || '',
        });
        setShowModal(true);
    };

    // 提交表单
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.host.trim()) {
            showMessage('error', '请输入域名');
            return;
        }

        try {
            setLoading(true);

            if (modalMode === 'create') {
                const res = await domainApi.create(formData);
                if (res.data.code === 0) {
                    showMessage('success', '创建成功');
                    setShowModal(false);
                    loadDomains();
                } else {
                    showMessage('error', res.data.message || '创建失败');
                }
            } else if (editingDomain) {
                const updateData: UpdateDomainRequest = {
                    host: formData.host,
                    is_active: formData.is_active,
                    is_default: formData.is_default,
                    notes: formData.notes || undefined,
                };
                const res = await domainApi.update(editingDomain.id, updateData);
                if (res.data.code === 0) {
                    showMessage('success', '更新成功');
                    setShowModal(false);
                    loadDomains();
                } else {
                    showMessage('error', res.data.message || '更新失败');
                }
            }
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'response' in error
                ? (error.response as { data?: { message?: string } })?.data?.message || '操作失败'
                : '操作失败';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    // 删除域名
    const handleDelete = async (domain: Domain) => {
        try {
            setLoading(true);
            const res = await domainApi.delete(domain.id);
            if (res.data.code === 0) {
                showMessage('success', '删除成功');
                setDeletingDomain(null);
                loadDomains();
            } else {
                showMessage('error', res.data.message || '删除失败');
            }
        } catch (error: unknown) {
            const message = error && typeof error === 'object' && 'response' in error
                ? (error.response as { data?: { message?: string } })?.data?.message || '删除失败'
                : '删除失败';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };

    // 格式化时间
    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString('zh-CN');
    };

    return (
        <div className="p-6">
            {/* 消息提示 */}
            {message && (
                <div className="toast toast-top toast-center z-50">
                    <div className={`alert ${
                        message.type === 'success' ? 'alert-success' :
                        message.type === 'error' ? 'alert-error' :
                        'alert-info'
                    } shadow-lg`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                            {message.type === 'success' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : message.type === 'error' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                        </svg>
                        <span>{message.text}</span>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">域名管理</h1>
                    <p className="text-sm text-gray-500 mt-1">共 {total} 个域名</p>
                </div>
                <button 
                    className="btn btn-primary"
                    onClick={handleCreate}
                    disabled={loading}
                >
                    + 添加域名
                </button>
            </div>

            {/* 域名列表 */}
            <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>域名</th>
                            <th>状态</th>
                            <th>默认</th>
                            <th>备注</th>
                            <th>创建时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && domains.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8">
                                    <span className="loading loading-spinner loading-lg"></span>
                                </td>
                            </tr>
                        ) : domains.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500">
                                    暂无域名
                                </td>
                            </tr>
                        ) : (
                            domains.map((domain) => (
                                <tr key={domain.id}>
                                    <td>{domain.id}</td>
                                    <td className="font-mono">{domain.host}</td>
                                    <td>
                                        <span className={`badge ${domain.is_active ? 'badge-success' : 'badge-error'}`}>
                                            {domain.is_active ? '启用' : '禁用'}
                                        </span>
                                    </td>
                                    <td>
                                        {domain.is_default ? (
                                            <span className="badge badge-primary">默认</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td>{domain.notes || '-'}</td>
                                    <td className="text-sm text-gray-500">
                                        {formatTime(domain.created_at)}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-sm btn-ghost"
                                                onClick={() => handleEdit(domain)}
                                                disabled={loading}
                                            >
                                                编辑
                                            </button>
                                            <button
                                                className={`btn btn-sm ${
                                                    domain.is_default === 1 
                                                        ? 'btn-disabled text-gray-400 cursor-not-allowed' 
                                                        : 'btn-ghost text-error hover:bg-error hover:text-white'
                                                }`}
                                                onClick={() => setDeletingDomain(domain)}
                                                disabled={loading || domain.is_default === 1}
                                            >
                                                删除
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <div className="join">
                        <button
                            className="join-item btn"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                        >
                            «
                        </button>
                        <button className="join-item btn">
                            第 {page} / {totalPages} 页
                        </button>
                        <button
                            className="join-item btn"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                        >
                            »
                        </button>
                    </div>
                </div>
            )}

            {/* 删除确认弹窗 */}
            {deletingDomain && (
                <div className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">确认删除</h3>
                        <p className="py-4">
                            确定要删除域名 <span className="font-mono font-bold">"{deletingDomain.host}"</span> 吗？
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setDeletingDomain(null)}
                                disabled={loading}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={() => handleDelete(deletingDomain)}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="loading loading-spinner loading-sm"></span>
                                        删除中...
                                    </>
                                ) : (
                                    '确认删除'
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => !loading && setDeletingDomain(null)}></div>
                </div>
            )}

            {/* 创建/编辑弹窗 */}
            {showModal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-lg">
                        <h3 className="font-bold text-lg mb-6">
                            {modalMode === 'create' ? '添加域名' : '编辑域名'}
                        </h3>
                    
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">域名 <span className="text-error">*</span></span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="例如: example.com"
                                    className="input input-bordered w-full focus:input-primary"
                                    value={formData.host}
                                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                    required
                                    autoFocus
                                />
                                <label className="label">
                                    <span className="label-text-alt text-gray-500">请输入完整的域名</span>
                                </label>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-medium">备注</span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered w-full focus:textarea-primary resize-none"
                                    placeholder="可选备注信息"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            <div className="divider my-2"></div>

                            <div className="space-y-3">
                                <div className="form-control">
                                    <label className="label cursor-pointer justify-start gap-3 py-3 px-4 rounded-lg hover:bg-base-200 transition-colors">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary"
                                            checked={formData.is_active === 1}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                is_active: e.target.checked ? 1 : 0 
                                            })}
                                        />
                                        <div className="flex flex-col">
                                            <span className="label-text font-medium">启用该域名</span>
                                            <span className="label-text-alt text-gray-500">启用后该域名可用于生成短链接</span>
                                        </div>
                                    </label>
                                </div>

                                <div className="form-control">
                                    <label className={`label cursor-pointer justify-start gap-3 py-3 px-4 rounded-lg transition-colors ${
                                        editingDomain?.is_default === 1 && formData.is_default === 1
                                            ? 'opacity-60'
                                            : 'hover:bg-base-200'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary"
                                            checked={formData.is_default === 1}
                                            onChange={(e) => setFormData({ 
                                                ...formData, 
                                                is_default: e.target.checked ? 1 : 0 
                                            })}
                                            disabled={editingDomain?.is_default === 1 && formData.is_default === 1}
                                        />
                                        <div className="flex flex-col">
                                            <span className="label-text font-medium">
                                                设为默认域名
                                                {editingDomain?.is_default === 1 && formData.is_default === 1 && (
                                                    <span className="ml-2 text-xs text-warning">(必须保留至少一个默认域名)</span>
                                                )}
                                            </span>
                                            <span className="label-text-alt text-gray-500">默认域名将优先用于生成短链接</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-action mt-6">
                                <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setShowModal(false)}
                                    disabled={loading}
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="loading loading-spinner loading-sm"></span>
                                            提交中...
                                        </>
                                    ) : (
                                        modalMode === 'create' ? '创建' : '保存'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                    <div className="modal-backdrop" onClick={() => !loading && setShowModal(false)}></div>
                </div>
            )}
        </div>
    );
}