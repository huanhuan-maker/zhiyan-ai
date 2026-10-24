import { createApiClient, ApiError } from "./client";

export const TOKEN_KEY = "zhiyan.tduck.v3.token";
let expired: (token: string) => void = () => {};
export function onSessionExpired(handler: typeof expired) {
  expired = handler;
}
const api = createApiClient({
  getToken: () => sessionStorage.getItem(TOKEN_KEY),
  onUnauthorized: (token) => expired(token),
});
export interface LoginResult {
  name: string;
  token: string;
  admin?: boolean;
  isAdmin?: boolean;
  needChangePassword?: boolean;
}
export interface Profile {
  name: string;
  admin?: boolean;
  isAdmin?: boolean;
}
export interface FormRecord {
  id: number;
  formKey: string;
  name: string;
  textName?: string;
  description?: string;
  status: number;
  type: number;
  typeDesc?: string;
  folder: boolean;
  folderId: number;
  createTime?: string;
  updateTime?: string;
}
export interface Page<T> {
  records: T[];
  total: number;
  current: number;
  size: number;
  pages: number;
}
export interface FormItem {
  id: number;
  formItemId: string;
  type: string;
  label: string;
  textLabel?: string;
  required: boolean;
  sort: number;
  scheme?: Record<string, unknown>;
  placeholder?: string;
}
export interface PageQuery {
  current: number;
  size: number;
  folderId: number;
  name?: string;
  status?: number;
  type?: number;
  folder?: boolean;
}
export const login = (account: string, password: string) =>
  api<LoginResult>(
    "/login/account",
    { method: "POST", body: JSON.stringify({ account, password }) },
    false
  );
export const currentUser = () => api<Profile>("/user/current/detail");
export async function getForms(query: PageQuery): Promise<Page<FormRecord>> {
  // URL query is built locally; credentials are exclusively in the header.
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return queryApi<Page<FormRecord>>("/user/form/page", params);
}
// Keep base paths restricted while allowing typed query parameters.
async function queryApi<T>(path: string, params: URLSearchParams) {
  return api<T>(path, { query: params });
}
export async function getForm(key: string): Promise<FormRecord> {
  const value = await api<FormRecord | null>(
    `/user/form/${encodeURIComponent(key)}`
  );
  if (!value || value.folder)
    throw new ApiError("business", "问卷不存在或已被移除");
  return value;
}
export const getFormItems = (key: string) =>
  queryApi<FormItem[]>("/user/form/item/list", new URLSearchParams({ key }));
export const statusLabel = (status: number) =>
  ({ 1: "未发布", 2: "收集中", 3: "已停止" }[status] ?? "未知状态");
export const typeLabel = (type: number) =>
  ({ 1: "普通问卷", 2: "流程表单", 3: "文件夹", 4: "考试问卷" }[type] ??
  "其他类型");
export const itemTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    INPUT: "单行文本", NUMBER: "数字", TEXTAREA: "多行文本", SELECT: "下拉框",
    CASCADER: "级联选择", SORT: "排序", SLIDER: "滑块", RADIO: "单选框",
    CHECKBOX: "多选框", DATE: "日期选择", DATE_RANGE: "日期范围", RATE: "评分",
    IMAGE_UPLOAD: "图片上传", UPLOAD: "文件上传", IMAGE: "图片展示", IMAGE_SELECT: "图片选择",
    IMAGE_CAROUSEL: "图片轮播", DESC_TEXT: "文字描述", SIGN_PAD: "手写签名", PAGINATION: "分页",
    DIVIDER: "分割线", PROVINCE_CITY: "省市联动", PHONE_VERIFICATION: "手机号验证", SUB_FORM: "子表单",
    INPUT_MAP: "地理位置", MATRIX_INPUT: "矩阵填空", MATRIX_SCALE: "矩阵量表", HORIZONTAL_INPUT: "横向填空",
    MATRIX_SELECT: "矩阵选择", USER_SELECT: "成员选择", DEPT_SELECT: "部门选择", OCR: "文字识别",
    RANDOM_NUMBER: "随机编号", FUNCTION_CALC: "函数计算", GOODS_SELECT: "商品选择", RESERVE_DAY: "预约日期",
    RESERVE_TIME_RANGE: "预约时段"
  };
  return labels[type] ?? "扩展题型";
};
