import axios from "axios";

const api = axios.create({
    baseURL: "/",
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("auth_token") || "";
    if (token && config.url?.startsWith("/api/")) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const url = error?.config?.url || "";
        // 登录接口的 401 属于正常业务响应（如密码错误），不应跳转
        if (status === 401 && !url.includes("auth/login")) {
            localStorage.removeItem("auth_token");
            window.location.href = `${import.meta.env.BASE_URL}login`;
        }
        return Promise.reject(error);
    },
);

// 域名相关接口类型定义
export interface Domain {
    id: number;
    host: string;
    is_active: number;
    is_default: number;
    notes: string | null;
    error_template_id: number | null;
    password_template_id: number | null;
    interstitial_template_id: number | null;
    created_at: number;
    updated_at: number;
}

export interface DomainWithLinkCount extends Domain {
    link_count: number;
}

export interface DomainListResponse {
    results: Domain[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}

export interface CreateDomainRequest {
    host: string;
    is_active?: number;
    is_default?: number;
    notes?: string;
    error_template_id?: number;
    password_template_id?: number;
    interstitial_template_id?: number;
}

export interface UpdateDomainRequest {
    host?: string;
    is_active?: number;
    is_default?: number;
    notes?: string;
    error_template_id?: number | null;
    password_template_id?: number | null;
    interstitial_template_id?: number | null;
}

// 域名 API 方法
export const domainApi = {
    // 获取域名列表
    getList: (page: number = 1, pageSize: number = 10) => 
        api.get<{ code: number; message: string; data: DomainListResponse }>(
            `/api/domain/list?page=${page}&pageSize=${pageSize}`
        ),
    
    // 获取域名详情
    getDetail: (id: number) =>
        api.get<{ code: number; message: string; data: DomainWithLinkCount }>(
            `/api/domain/detail/${id}`
        ),
    
    // 创建域名
    create: (data: CreateDomainRequest) =>
        api.post<{ code: number; message: string; data?: Domain }>(
            '/api/domain/create',
            data
        ),
    
    // 更新域名
    update: (id: number, data: UpdateDomainRequest) =>
        api.put<{ code: number; message: string; data?: Domain }>(
            `/api/domain/update/${id}`,
            data
        ),
    
    // 删除域名
    delete: (id: number) =>
        api.delete<{ code: number; message: string }>(
            `/api/domain/delete/${id}`
        ),
};

export default api;