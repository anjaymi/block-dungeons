(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.GameDisplay = factory(root);
})(typeof window === 'object' ? window : this, function (env) {
  'use strict';
  const doc = env.document;
  let busy = false, landscape = false, orientationOwned = false, orientationPending = false;
  let controls = null, hooks = {}, lastPresentation = '', noticeOpen = false;
  const active = () => doc.fullscreenElement || doc.webkitFullscreenElement || null;
  const matches = query => !!env.matchMedia?.(query).matches;
  const standalone = () => env.navigator?.standalone === true || matches('(display-mode: standalone)') || matches('(display-mode: fullscreen)');
  function status() {
    return { active: !!active(), standalone: standalone(), busy, label: active() ? '退出全屏' : standalone() ? '全屏已开启' : '全屏游戏' };
  }
  function viewport() {
    return { width: Math.max(1, Math.round(env.visualViewport?.width || env.innerWidth)), height: Math.max(1, Math.round(env.visualViewport?.height || env.innerHeight)) };
  }
  function unlock() {
    if (!orientationOwned) return;
    orientationOwned = false;
    try { env.screen?.orientation?.unlock?.(); } catch (_) {}
  }
  function lockLandscape() {
    if (!landscape || !active() || orientationOwned || orientationPending || !env.screen?.orientation?.lock) return;
    orientationPending = true;
    try {
      Promise.resolve(env.screen.orientation.lock('landscape')).then(() => {
        orientationOwned = true;
        if (!active()) unlock();
      }, () => {}).finally(() => { orientationPending = false; });
    } catch (_) { orientationPending = false; }
  }
  function refresh() {
    if (!controls) return;
    const S = status();
    controls.button.disabled = busy || (S.standalone && !S.active);
    controls.button.setAttribute('aria-pressed', String(S.active || S.standalone));
    controls.button.setAttribute('aria-label', S.label);
    controls.label.textContent = controls.button.classList.contains('compact') ? S.active ? '退出' : S.standalone ? '已全屏' : '全屏' : S.label;
  }
  function dismissNotice() {
    if (!noticeOpen) return;
    noticeOpen = false;
    if (controls) controls.notice.hidden = true;
    hooks.onNotice?.(false);
  }
  function notify(unsupported) {
    if (controls) {
      const ios = /iphone|ipad|ipod/i.test(env.navigator?.userAgent || '') || (env.navigator?.platform === 'MacIntel' && env.navigator?.maxTouchPoints > 1);
      controls.title.textContent = unsupported ? '从主屏幕全屏游玩' : '暂时无法进入全屏';
      controls.message.textContent = unsupported ? ios
        ? '在 Safari 打开游戏，点「分享」→「添加到主屏幕」。若有「作为网页 App 打开」，保持开启；以后从主屏幕的游戏图标进入。'
        : '点浏览器菜单 →「添加到主屏幕」，以后从主屏幕的游戏图标进入；也可以换用支持全屏的浏览器。'
        : '请重新点击「全屏游戏」。若仍无法进入，请在浏览器中直接打开游戏页面。';
      controls.notice.hidden = false;
    }
    noticeOpen = true;
    hooks.onNotice?.(true);
  }
  function changed() {
    if (active()) { dismissNotice(); lockLandscape(); }
    else { landscape = false; unlock(); }
    refresh();
    if (env.dispatchEvent && env.Event) env.dispatchEvent(new env.Event('resize'));
    hooks.onChange?.();
  }
  function toggle(options = {}) {
    if (busy) return Promise.resolve(false);
    const exiting = !!active(), element = doc.documentElement;
    if (!exiting && standalone()) return Promise.resolve(true);
    const request = element?.requestFullscreen || element?.webkitRequestFullscreen;
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    const allowed = element?.requestFullscreen ? doc.fullscreenEnabled !== false : doc.webkitFullscreenEnabled !== false;
    if (exiting ? !exit : !request || !allowed) {
      notify(true); return Promise.resolve(false);
    }
    dismissNotice(); busy = true; landscape = !exiting && !!options.landscape; refresh();
    let operation;
    try {
      // Keep this call in the original click/touch event's user activation.
      operation = exiting ? exit.call(doc) : element.requestFullscreen
        ? request.call(element, { navigationUI: 'hide' }) : request.call(element);
    } catch (_) {
      busy = false; landscape = false; refresh(); notify(false); return Promise.resolve(false);
    }
    return Promise.resolve(operation).then(() => {
      if (active()) lockLandscape(); else unlock();
      return true;
    }, () => { landscape = false; notify(false); return false; }).finally(() => { busy = false; refresh(); });
  }
  function mount(options = {}) {
    hooks = options;
    const button = doc.getElementById('game-fullscreen');
    if (!button?.querySelector || !button?.setAttribute) return;
    controls = { button, label: button.querySelector('span'), notice: doc.getElementById('fullscreen-help'), title: doc.getElementById('fullscreen-help-title'), message: doc.getElementById('fullscreen-help-message') };
    button.addEventListener('pointerdown', event => event.stopPropagation());
    button.addEventListener('click', event => {
      event.stopPropagation(); hooks.onRequest?.(); toggle({ landscape: hooks.mobile?.() });
    });
    doc.getElementById('fullscreen-help-close').addEventListener('click', dismissNotice);
    refresh();
  }
  function present(P) {
    if (!controls) return;
    const key = [P.mobile, P.hidden, P.compact, P.top, P.right].join(':');
    if (key === lastPresentation) return;
    lastPresentation = key;
    controls.button.hidden = !P.mobile || !!P.hidden;
    controls.button.classList.toggle('compact', !!P.compact);
    controls.button.style.top = Math.round(P.top) + 'px';
    controls.button.style.right = Math.round(P.right) + 'px';
    refresh();
  }
  doc.addEventListener?.('fullscreenchange', changed);
  doc.addEventListener?.('webkitfullscreenchange', changed);
  function failed() { busy = false; landscape = false; refresh(); notify(false); }
  doc.addEventListener?.('fullscreenerror', failed);
  doc.addEventListener?.('webkitfullscreenerror', failed);
  return { status, viewport, toggle, mount, present, dismissNotice };
});
