/**
 * Google アナリティクス（GA4）。計測IDはビルド時の環境変数 VITE_GA_ID（例: G-XXXXXXXXXX）。
 * 未設定なら何もしない。名前・生年月日などの個人情報は一切送らない。
 */
declare global {
  interface Window { dataLayer: unknown[]; gtag?: (...args: unknown[]) => void }
}

const GA_ID: string = import.meta.env.VITE_GA_ID ?? '';
let ready = false;

export function initAnalytics(): void {
  if (!GA_ID || ready) return;
  ready = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args); };
  window.gtag('js', new Date());
  // SPA なので自動ページビューは止め、画面遷移ごとに手動で送る
  window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

/** 画面表示（screen: home / play / zukan / parent / profiles など） */
export function trackScreen(screen: string, params: Record<string, string | number | boolean> = {}): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', 'page_view', { page_title: screen, page_location: `${location.origin}${location.pathname}#${screen}`, ...params });
}

/** 任意イベント */
export function track(event: string, params: Record<string, string | number | boolean> = {}): void {
  if (!GA_ID || !window.gtag) return;
  window.gtag('event', event, params);
}
