/**
 * CanvasCompositor.js
 * 纯客户端 Canvas 图层合成、手势交互与本地导出。
 *
 * 所有位图都经由 FileReader 转成 data URL 再进入画布，因此不会触发
 * canvas 的跨域污染（tainted canvas），导出始终可用。
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CanvasCompositor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MIN_ZOOM = 30;
  const MAX_ZOOM = 250;

  function clampZoom(value) {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }

  class Compositor {
    /**
     * @param {HTMLCanvasElement} canvas 目标物理画布
     * @param {HTMLElement} wrapper      可视化视口容器
     * @param {Object} [options]
     */
    constructor(canvas, wrapper, options = {}) {
      this.canvas = canvas;
      this.wrapper = wrapper;
      this.ctx = canvas.getContext('2d');

      this.width = options.width || 1152;
      this.height = options.height || 2048;
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      this.backgroundColor = options.backgroundColor || '#0a0d12';

      this.state = {
        image: null,
        offsetX: 0,
        offsetY: 0,
        zoom: 100,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        initialOffsetX: 0,
        initialOffsetY: 0
      };

      this.customRenderCallback = null;
      this.onTransformChange = options.onTransformChange || null;

      this._pinch = null;
      this._rafId = 0;
      this._usingRaf = false;
      this._abort = new AbortController();

      this._initEvents();
    }

    /** 注册业务图层绘制回调（排版、蒙版、Logo）。 */
    setRenderPipeline(callback) {
      this.customRenderCallback = callback;
    }

    /** 视口显示尺寸与画布物理像素的比率。 */
    getScaleRatio() {
      const rect = this.wrapper.getBoundingClientRect();
      return {
        scaleX: this.width / (rect.width || this.width),
        scaleY: this.height / (rect.height || this.height)
      };
    }

    /**
     * 载入本地文件 / 剪贴板中的图片。
     * @param {File|Blob} file
     * @returns {Promise<HTMLImageElement>}
     */
    loadImageFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
          reject(new Error('请选择图片文件（PNG / JPEG / WebP 等）'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            this.state.image = img;
            this.render();
            resolve(img);
          };
          img.onerror = () => reject(new Error('图片解码失败，文件可能已损坏'));
          img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('读取本地文件失败'));
        reader.readAsDataURL(file);
      });
    }

    /** 移除底图。 */
    clearImage() {
      this.state.image = null;
      this.render();
    }

    /** 更新位置与缩放；传 null 表示该项保持不变。 */
    setTransform(offsetX, offsetY, zoom) {
      if (typeof offsetX === 'number' && isFinite(offsetX)) this.state.offsetX = offsetX;
      if (typeof offsetY === 'number' && isFinite(offsetY)) this.state.offsetY = offsetY;
      if (typeof zoom === 'number' && isFinite(zoom)) this.state.zoom = clampZoom(zoom);
      this.render();
      this._emitTransform();
    }

    resetTransform() {
      this.setTransform(0, 0, 100);
    }

    _emitTransform() {
      if (this.onTransformChange) this.onTransformChange(this.state);
    }

    /**
     * 合并同一帧内的多次重绘请求。
     *
     * 后台标签页里 requestAnimationFrame 不会触发，此时退回 setTimeout，
     * 否则页面在不可见期间的所有更新都会被静默丢弃。
     */
    requestRender() {
      if (this._rafId) return;

      const hidden = typeof document !== 'undefined' && document.hidden;
      const useRaf = typeof requestAnimationFrame === 'function' && !hidden;

      this._usingRaf = useRaf;
      const schedule = useRaf ? requestAnimationFrame : (cb) => setTimeout(cb, 16);

      this._rafId = schedule(() => {
        this._rafId = 0;
        this.render();
      });
    }

    /** 取消尚未执行的重绘请求。 */
    _cancelPendingRender() {
      if (!this._rafId) return;
      if (this._usingRaf && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this._rafId);
      } else {
        clearTimeout(this._rafId);
      }
      this._rafId = 0;
    }

    /** 立即执行一次完整渲染。 */
    render() {
      const { ctx, width, height } = this;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, width, height);

      if (this.state.image) {
        const geo = this._imageGeometry();
        ctx.save();
        ctx.drawImage(this.state.image, geo.x, geo.y, geo.width, geo.height);
        ctx.restore();
      }

      if (this.customRenderCallback) {
        this.customRenderCallback(this.ctx, width, height);
      }
    }

    /** 计算底图以 cover 模式铺满后，叠加缩放与位移的实际绘制矩形。 */
    _imageGeometry() {
      const img = this.state.image;
      const scale = this.state.zoom / 100;
      const canvasRatio = this.width / this.height;
      const imgRatio = img.width / img.height;

      let baseW;
      let baseH;
      if (imgRatio > canvasRatio) {
        baseH = this.height;
        baseW = this.height * imgRatio;
      } else {
        baseW = this.width;
        baseH = this.width / imgRatio;
      }

      const renderW = baseW * scale;
      const renderH = baseH * scale;

      return {
        x: (this.width - renderW) / 2 + this.state.offsetX,
        y: (this.height - renderH) / 2 + this.state.offsetY,
        width: renderW,
        height: renderH
      };
    }

    /**
     * 以画布上某一点为锚点缩放，使该点在缩放前后停留在原位。
     * @param {number} nextZoom  目标缩放百分比
     * @param {number} anchorX   锚点在画布坐标系中的 x
     * @param {number} anchorY   锚点在画布坐标系中的 y
     */
    zoomAt(nextZoom, anchorX, anchorY) {
      const target = clampZoom(nextZoom);
      const current = this.state.zoom;
      if (target === current) return;

      if (!this.state.image) {
        this.setTransform(null, null, target);
        return;
      }

      const before = this._imageGeometry();
      const ratioX = before.width ? (anchorX - before.x) / before.width : 0.5;
      const ratioY = before.height ? (anchorY - before.y) / before.height : 0.5;

      this.state.zoom = target;
      const after = this._imageGeometry();

      this.state.offsetX = Math.round(
        this.state.offsetX + (anchorX - (after.x + ratioX * after.width))
      );
      this.state.offsetY = Math.round(
        this.state.offsetY + (anchorY - (after.y + ratioY * after.height))
      );

      this.render();
      this._emitTransform();
    }

    /** 把视口内的客户端坐标换算成画布坐标。 */
    _toCanvasPoint(clientX, clientY) {
      const rect = this.wrapper.getBoundingClientRect();
      const scaleX = this.width / (rect.width || this.width);
      const scaleY = this.height / (rect.height || this.height);
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    _beginDrag(clientX, clientY) {
      this.state.isDragging = true;
      this.state.dragStartX = clientX;
      this.state.dragStartY = clientY;
      this.state.initialOffsetX = this.state.offsetX;
      this.state.initialOffsetY = this.state.offsetY;
    }

    _moveDrag(clientX, clientY) {
      const { scaleX, scaleY } = this.getScaleRatio();
      this.state.offsetX = Math.round(
        this.state.initialOffsetX + (clientX - this.state.dragStartX) * scaleX
      );
      this.state.offsetY = Math.round(
        this.state.initialOffsetY + (clientY - this.state.dragStartY) * scaleY
      );
      this.requestRender();
      this._emitTransform();
    }

    _initEvents() {
      const wrapper = this.wrapper;
      const signal = this._abort.signal;

      wrapper.addEventListener('mousedown', (e) => {
        if (!this.state.image || e.button !== 0) return;
        this._beginDrag(e.clientX, e.clientY);
        e.preventDefault();
      }, { signal });

      window.addEventListener('mousemove', (e) => {
        if (!this.state.isDragging) return;
        this._moveDrag(e.clientX, e.clientY);
      }, { signal });

      window.addEventListener('mouseup', () => {
        this.state.isDragging = false;
      }, { signal });

      // 单指平移 / 双指捏合缩放
      wrapper.addEventListener('touchstart', (e) => {
        if (!this.state.image) return;

        if (e.touches.length === 1) {
          this._pinch = null;
          this._beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        } else if (e.touches.length === 2) {
          this.state.isDragging = false;
          this._pinch = {
            startDistance: this._touchDistance(e.touches),
            startZoom: this.state.zoom
          };
        }
      }, { passive: true, signal });

      wrapper.addEventListener('touchmove', (e) => {
        if (!this.state.image) return;

        if (this._pinch && e.touches.length === 2) {
          const distance = this._touchDistance(e.touches);
          if (this._pinch.startDistance > 0) {
            const mid = this._toCanvasPoint(
              (e.touches[0].clientX + e.touches[1].clientX) / 2,
              (e.touches[0].clientY + e.touches[1].clientY) / 2
            );
            const nextZoom = this._pinch.startZoom * (distance / this._pinch.startDistance);
            this.zoomAt(nextZoom, mid.x, mid.y);
          }
          return;
        }

        if (this.state.isDragging && e.touches.length === 1) {
          this._moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true, signal });

      const endTouch = (e) => {
        if (!e.touches || e.touches.length === 0) {
          this.state.isDragging = false;
          this._pinch = null;
        } else if (e.touches.length === 1) {
          this._pinch = null;
          this._beginDrag(e.touches[0].clientX, e.touches[0].clientY);
        }
      };
      window.addEventListener('touchend', endTouch, { signal });
      window.addEventListener('touchcancel', endTouch, { signal });

      // 滚轮缩放：以光标位置为锚点
      wrapper.addEventListener('wheel', (e) => {
        if (!this.state.image) return;
        e.preventDefault();
        const step = e.deltaY < 0 ? 4 : -4;
        const point = this._toCanvasPoint(e.clientX, e.clientY);
        this.zoomAt(this.state.zoom + step, point.x, point.y);
      }, { passive: false, signal });
    }

    _touchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 导出高清图并触发本地下载。
     * @returns {Promise<Blob>}
     */
    export(fileName = 'Poster.jpg', quality = 0.95, mimeType = 'image/jpeg') {
      // 导出前强制同步渲染一次，避免用上一帧的画面
      this._cancelPendingRender();
      this.render();

      return new Promise((resolve, reject) => {
        try {
          this.canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('画布导出失败，浏览器未能生成图片数据'));
              return;
            }

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = fileName;
            link.href = url;
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // 立刻 revoke 会让部分浏览器的下载中断，延后释放
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            resolve(blob);
          }, mimeType, quality);
        } catch (err) {
          // 画布被跨域图片污染时 toBlob 会抛 SecurityError
          reject(err);
        }
      });
    }

    /** 解绑所有全局监听，避免多实例场景下的内存泄漏。 */
    destroy() {
      this._abort.abort();
      this._cancelPendingRender();
    }
  }

  Compositor.MIN_ZOOM = MIN_ZOOM;
  Compositor.MAX_ZOOM = MAX_ZOOM;

  return Compositor;
}));
