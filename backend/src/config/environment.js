export const normalizeNodeEnv = (value = process.env.NODE_ENV) => String(value ?? '').trim().toLowerCase();
export const isProduction = (value = process.env.NODE_ENV) => normalizeNodeEnv(value) === 'production';
