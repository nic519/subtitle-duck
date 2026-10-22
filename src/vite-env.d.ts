/// <reference types="vite/client" />

// 构建时从 package.json 注入，界面不单独维护版本号。
declare const __APP_VERSION__: string;
