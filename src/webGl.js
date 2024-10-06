import { keyToCoords, parseRGBaCords } from "./utils.js";

const vertexShaderCode = `
attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0, 1);
}
`;

const fragmentShaderCode = `
precision mediump float;

varying vec2 v_texCoord;

uniform sampler2D u_currentState;
uniform float u_pixelSize;

vec2 wrapToroidalCords(vec2 coord) {
    return mod((coord + 1.0), 1.0);
}

void main() {
    vec4 currentCell = texture2D(u_currentState, v_texCoord);
    int aliveNeighbors = 0;
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            if (dx != 0 || dy != 0) {
                vec2 offset = vec2(float(dx), float(dy)) * u_pixelSize;
                vec2 neighborCoord = wrapToroidalCords(v_texCoord + offset);
                vec4 neighbor = texture2D(u_currentState, neighborCoord);
                aliveNeighbors += int(neighbor.r > 0.5);
            }
        }
    }

    float newState = 0.0;

    if (currentCell.r > 0.5) {
        if (aliveNeighbors < 2 || aliveNeighbors > 3) {
            newState = 0.0;
        } else {
            newState = 1.0;
        }
    } else {
        if (aliveNeighbors == 3) {
            newState = 1.0;
        }
    }

    if (newState > 0.5) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    } else {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  }
  console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createShaderProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Unable to initialize the shader program.");
  }
  return program;
}

function createTexture(gl, size, idx = 0, data = null) {
  gl.activeTexture(gl.TEXTURE0 + idx);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size.x,
    size.y,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data
  );
  return texture;
}

const bindFrameBuffer = (gl, framebuffer, resultTexture) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    resultTexture,
    0
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer not complete");
  }
  return framebuffer;
};

export class WebGlCountGame {
  static isWebGLAvailable() {
    return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        console.log("WebGL is not supported in your browser.");
        return false;
    }
    console.log("WebGL is supported.");
    return true;
  }

  constructor(size) {
    if (WebGlCountGame.instance) {
      return WebGlCountGame.instance;
    }
    console.log('WebGlCountGame');
    WebGlCountGame.instance = this;
    this.size = size;

    // ! check binds for unnecessary
    this.countAliveSet.bind(this);
    this.renderToCanvas.bind(this);
    this.countNextState.bind(this);
    this.updateSize.bind(this);

    this.init();
  }

  init() {
    this.el = document.createElement("canvas");
    this.gl = this.el.getContext("webgl");

    const { gl, el, size } = this;

    el.width = size.x;
    el.height = size.y;

    this.program = createShaderProgram(
      gl,
      vertexShaderCode,
      fragmentShaderCode
    );
    const { program } = this;
    gl.useProgram(program);
    this.createScene(gl, program, size);

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    this.frameBuffer = gl.createFramebuffer();
  }

  createScene = (gl, program, size) => {
    const vertexPositions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW);
  
    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(program, "u_pixelSize"), 1.0 / size.x);
  };

  countNextState(gl, frameBuffer, size, stateArray) {
    const { x, y } = size;
    gl.viewport(0, 0, x, y);

    let currentStateTexture = createTexture(gl, size, 0, stateArray);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentStateTexture);
    gl.uniform1i(gl.getUniformLocation(this.program, "u_currentState"), 0);

    let resultTexture = createTexture(gl, size, 1);

    frameBuffer = bindFrameBuffer(gl, frameBuffer, resultTexture);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // const temp = currentStateTexture;
    // currentStateTexture = resultTexture;
    // resultTexture = temp;

    const pixelData = new Uint8Array(x * y * 4);
    gl.readPixels(0, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

    const newSet = new Set();
    for (let i = 0; i < pixelData.length; i += 4) {
      const nX = (i / 4) % x;
      const nY = Math.floor(i / 4 / y);
      if (pixelData[i] > 128) {
        newSet.add(`${nX}:${nY}`);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.renderToCanvas(currentStateTexture);
    currentStateTexture = null;
    resultTexture = null;
    return { newSet };
  }

  countAliveSet(aliveSet) {
    const { gl, size } = this;
    const stateArray = new Uint8Array(size.x * size.y * 4);

    aliveSet.forEach((cords) => {
      const [x, y] = keyToCoords(cords);
      const index = (y * this.size.x + x) * 4;
      stateArray[index] = 255;
      stateArray[index + 1] = 0;
      stateArray[index + 2] = 0;
      stateArray[index + 3] = 255;
    });

    const { newSet } = this.countNextState(
      gl,
      this.frameBuffer,
      size,
      stateArray
    );
    return newSet;
  }

  renderToCanvas(texture) {
    const { gl, el } = this;
    if (!gl.isTexture(texture)) {
      console.error("Texture is not valid or not bound correctly.");
      return;
    }
    gl.viewport(0, 0, el.width, el.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.checkGLErrors();
  }

  checkGLErrors() {
    const { gl } = this;
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      console.error("WebGL error occurred: ", error);
    }
  }

  checkTextureOutput() {
    const { gl } = this;
    const width = this.size.x;
    const height = this.size.y;
    const pixelData = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);
    console.log("Texture pixel data:", parseRGBaCords(pixelData, 5));
  }

  updateSize(newSize) {
    this.size = newSize;
    this.el.width = newSize.x;
    this.el.height = newSize.y;
    this.frameBuffer = bindFrameBuffer(this.gl, newSize);
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.program, "u_textureSize"),
      newSize.x,
      newSize.y
    );
    this.gl.uniform1f(
      this.gl.getUniformLocation(this.program, "u_pixelSize"),
      1.0 / newSize.x
    );
  }

  clean() {
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    if (this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null;
    }
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer);
      this.positionBuffer = null;
    }
    if (this.frameBuffer) {
      this.gl.deleteFramebuffer(this.frameBuffer);
      this.positionBuffer = null;
    }
  }

  destroy() {
    this.clean();
    WebGlCountGame.instance = null;
    this.el = null;
    this.gl = null;
  }
}
