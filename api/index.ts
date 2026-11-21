import mainHandler from '../dist/main';

export default async function handler(req: any, res: any) {
  const fn = typeof mainHandler === 'function' ? mainHandler : (mainHandler as any)?.default;
  return fn(req, res);
}
