export const getSafeViewportSize = (mount) => Object.freeze({
  width: Math.max(1, Math.floor(Number(mount?.clientWidth) || 0)),
  height: Math.max(1, Math.floor(Number(mount?.clientHeight) || 0)),
});

export const hasUsableWebGL = (environment = globalThis) => {
  const canvas = environment.document?.createElement?.('canvas');
  return Boolean(environment.WebGLRenderingContext && canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
};

export const createRendererFallbackState = ({ reason = 'webgl-unavailable', mount } = {}) => Object.freeze({
  ok: false,
  reason,
  viewport: getSafeViewportSize(mount),
  recoverable: true,
});
