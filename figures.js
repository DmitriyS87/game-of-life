import { mixByOptions, roundToDecimal } from "./utils.js";

class Figure {
  constructor(ctx, x, y, dx, dy, color) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
    this.ctxWidth = ctx.canvas.width;
    this.ctxHeight = ctx.canvas.height;
  }

  clear() {
    const { ctx, x, y, dx, dy } = this;
    ctx.clearRect(x, y, dx, dy);
  }

  draw() {
    throw new Error('You have to implement method "draw" for your Figure');
  }
  update() {
    throw new Error('You have to implement method "update" for your Figure');
  }
}

class Square extends Figure {
  constructor(ctx, x, y, dx, dy, color) {
    super(ctx, x, y, dx, dy, color);
    this.countVisibleSquareSize();
  }

  countVisibleSquareSize() {
    this.vDX = roundToDecimal(this.dx - this.dx * 0.15);
    this.vDY = roundToDecimal(this.dy - this.dy * 0.15);
  }

  draw(options = {}) {
    const { ctx, x, y, dx, dy, color } = mixByOptions(
      ["ctx", "x", "y", "dx", "dy", "color"],
      this,
      options
    );
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, this.vDX, this.vDY);
    ctx.restore();
  }

  update(params = {}) {
    this.clear();
    [...Object.keys(params)].forEach((key) => (this[key] = params[key]));
    this.draw();
  }
}

export class Dot {
    constructor({ color, mW = 9, mH = 9 }) {
      this.color = color ?? "green";
      this.x = 0;
      this.y = 0;
      this.dx = Math.max(mW, 1);
      this.dy = Math.max(mH, 1);
      this._canvas = document.createElement("canvas");
      this._canvas.width = this.dx;
      this._canvas.height = this.dy;
      this.ctx = this._canvas.getContext("2d");
  
      this.render();
    }
  
    render() {
      this.countParams();
      this.draw();
    }
  
    countParams() {
      this.cX = Math.max(roundToDecimal((this.dx - this.x) / 2), 0.5);
      this.cY = Math.max(roundToDecimal((this.dy - this.y) / 2), 0.5);
      this.r = Math.max(this.dx / 2 - 1, 0.5);
    }
  
    draw(color) {
      const { ctx } = this;
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = color ?? this.color;
      ctx.arc(this.cX, this.cY, this.r, 0, Math.PI * 2, true);
      ctx.fill();
    }
  
    changedColor(color) {
      const { ctx } = this;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  
    getImage({ color } = {}) {
      if (color && this.color != color) {
        this.changedColor(color);
      }
      return this._canvas;
    }
  }
  