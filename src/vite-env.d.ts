/// <reference types="vite/client" />

// 安全约束：本项目的 LLM Key / Base URL / Model 仅在服务器侧（vite plugin）
// 读取 .env 中的 LLM_* 变量，**不再**通过 import.meta.env 暴露给前端 bundle。
// 此处保留空的扩展类型仅作占位，方便未来添加非敏感的 VITE_* 变量。
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
