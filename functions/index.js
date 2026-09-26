import { preferredLanguage, savedLanguage } from '../shared/language.mjs'

/** @type {import('@cloudflare/workers-types').PagesFunction} */
export function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  // 双重约束：即使路由配置变化，也不改写明确的语言地址或表单请求。
  if (url.pathname !== '/' || !['GET', 'HEAD'].includes(request.method)) return context.next()
  const language = savedLanguage(request.headers.get('Cookie') || '')
    || preferredLanguage(request.headers.get('Accept-Language') || '')
  url.pathname = `/${language}/`
  const origin = url.origin
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.href,
      'Cache-Control': 'private, no-store',
      Vary: 'Accept-Language, Cookie',
      Link: [
        ...[['zh', 'zh-CN'], ['en', 'en'], ['ja', 'ja']].map(([path, lang]) => `<${origin}/${path}/>; rel="alternate"; hreflang="${lang}"`),
        `<${origin}/>; rel="alternate"; hreflang="x-default"`,
      ].join(', '),
    },
  })
}
