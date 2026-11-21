import mainHandler from '../dist/src/main';

export default async function handler(req: any, res: any) {
  if (typeof req?.url === 'string' && req.url.startsWith('/v1/')) {
    req.url = `/api${req.url}`;
  }
  const fn = typeof mainHandler === 'function' ? mainHandler : (mainHandler as any)?.default;
  return fn(req, res);
}
