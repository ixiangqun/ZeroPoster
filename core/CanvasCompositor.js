/**
 * CanvasCompositor.js
 * 纯客户端 Canvas 实时图层合成、交互手势与无损导出中枢
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

  class Compositor {
    /**
     * @param {HTMLCanvasElement} canvas - 目标物理画布
     * @param {HTMLElement} wrapper - 可视化视口包裹容器
     * @param {Object} options - 配置参数
     */
    constructor(canvas, wrapper, options = {}) {
      this.canvas = canvas;
      this.wrapper = wrapper;
      this.ctx = canvas.getContext('2d');

      this.width = options.width || 1152;
      this.height = options.height || 2048;
      this.canvas.width = this.width;
      this.canvas.height = this.height;

      // 图像变换状态
      this.state = {
        image: null,
        offsetX: 0,
        offsetY: 0,
        zoom: 100, // 百分比 (30 ~ 250)
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        initialOffsetX: 0,
        initialOffsetY: 0
      };

      this.customRenderCallback = null;
      this.onTransformChange = options.onTransformChange || null;

      this._initEvents();
    }

    /**
     * 注册外层业务图层绘制回调（排版、蒙版、Logo）
     */
    setRenderPipeline(callback) {
      this.customRenderCallback = callback;
    }

    /**
     * 计算视口显示尺寸与 Canvas 物理像素的比率
     */
    getScaleRatio() {
      const rect = this.wrapper.getBoundingClientRect();
      return {
        scaleX: this.width / (rect.width || this.width),
        scaleY: this.height / (rect.height || this.height)
      };
    }

    /**
     * 载入本地文件或剪贴板 File 对象（零跨域污染管道）
     */
    loadImageFromFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
          return reject(new Error('Invalid image file'));
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            this.state.image = img;
            this.render();
            resolve(img);
          };
          img.onerror = reject;
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    /**
     * 手动更新位置与缩放
     */
    setTransform(offsetX, offsetY, zoom) {
      if (typeof offsetX === 'number') this.state.offsetX = offsetX;
      if (typeof offsetY === 'number') this.state.offsetY = offsetY;
      if (typeof zoom === 'number') this.state.zoom = Math.max(30, Math.min(250, zoom));
      this.render();
      if (this.onTransformChange) {
        this.onTransformChange(this.state);
      }
    }

    /**
     * 重置变换参数
     */
    resetTransform() {
      this.setTransform(0, 0, 100);
    }

    /**
     * 核心渲染流程
     */
    render() {
      const { ctx, width, height } = this;
      ctx.clearRect(0, 0, width, height);

      // 1. 绘制底层背景（纯净底色与柔和渐变衬底）
      ctx.fillStyle = '#0a0d12';
      ctx.fillRect(0, 0, width, height);

      // 2. 绘制图片（支持缩放与双向平移）
      if (this.state.image) {
        ctx.save();
        const img = this.state.image;
        const scale = (this.state.zoom / 100);

        // 计算 Cover 铺满模式的基础宽高
        const canvasRatio = width / height;
        const imgRatio = img.width / img.height;
        let baseW, baseH;

        if (imgRatio > canvasRatio) {
          baseH = height;
          baseW = height * imgRatio;
        } else {
          baseW = width;
          baseH = width / imgRatio;
        }

        const renderW = baseW * scale;
        const renderH = baseH * scale;

        // 居中偏移 + 用户微调位移
        const centerX = (width - renderW) / 2 + this.state.offsetX;
        const centerY = (height - renderH) / 2 + this.state.offsetY;

        ctx.drawImage(img, centerX, centerY, renderW, renderH);
        ctx.restore();
      }

      // 3. 执行外层挂载的排版渲染管线
      if (this.customRenderCallback) {
        this.customRenderCallback(this.ctx, width, height);
      }
    }

    /**
     * 绑定触控与鼠标手势
     */
    _initEvents() {
      const wrapper = this.wrapper;

      // 鼠标拖拽
      wrapper.addEventListener('mousedown', (e) => {
        if (!this.state.image) return;
        this.state.isDragging = true;
        this.state.dragStartX = e.clientX;
        this.state.dragStartY = e.clientY;
        this.state.initialOffsetX = this.state.offsetX;
        this.state.initialOffsetY = this.state.offsetY;
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.state.isDragging) return;
        const { scaleX, scaleY } = this.getScaleRatio();
        const dx = (e.clientX - this.state.dragStartX) * scaleX;
        const dy = (e.clientY - this.state.dragStartY) * scaleY;
        this.state.offsetX = Math.round(this.state.initialOffsetX + dx);
        this.state.offsetY = Math.round(this.state.initialOffsetY + dy);
        this.render();
        if (this.onTransformChange) this.onTransformChange(this.state);
      });

      window.addEventListener('mouseup', () => {
        this.state.isDragging = false;
      });

      // 移动端单指触控拖拽
      wrapper.addEventListener('touchstart', (e) => {
        if (!this.state.image || e.touches.length !== 1) return;
        this.state.isDragging = true;
        this.state.dragStartX = e.touches[0].clientX;
        this.state.dragStartY = e.touches[0].clientY;
        this.state.initialOffsetX = this.state.offsetX;
        this.state.initialOffsetY = this.state.offsetY;
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!this.state.isDragging || e.touches.length !== 1) return;
        const { scaleX, scaleY } = this.getScaleRatio();
        const dx = (e.touches[0].clientX - this.state.dragStartX) * scaleX;
        const dy = (e.touches[0].clientY - this.state.dragStartY) * scaleY;
        this.state.offsetX = Math.round(this.state.initialOffsetX + dx);
        this.state.offsetY = Math.round(this.state.initialOffsetY + dy);
        this.render();
        if (this.onTransformChange) this.onTransformChange(this.state);
      }, { passive: true });

      window.addEventListener('touchend', () => {
        this.state.isDragging = false;
      });

      // 滚轮双向平滑缩放
      wrapper.addEventListener('wheel', (e) => {
        if (!this.state.image) return;
        e.preventDefault();
        const delta = e.deltaY < 0 ? 4 : -4;
        this.setTransform(this.state.offsetX, this.state.offsetY, this.state.zoom + delta);
      }, { passive: false });
    }

    /**
     * 导出高清大图并触发本地下载
     */
    export(fileName = 'Poster.jpg', quality = 0.95, mimeType = 'image/jpeg') {
      return new Promise((resolve) => {
        this.canvas.toBlob((blob) => {
          const link = document.createElement('a');
          link.download = fileName;
          link.href = URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          resolve(blob);
        }, mimeType, quality);
      });
    }
  }

  return Compositor;
}));

