// button code was nicked from:
// https://github.com/toji/webvr.info/blob/master/samples/js/vr-samples-util.js
function addButton (message, callback) {
  function getButtonContainer () {
    var buttonContainer = document.getElementById("vr-sample-button-container");
    if (!buttonContainer) {
      buttonContainer = document.createElement("div");
      buttonContainer.id = "vr-sample-button-container";
      buttonContainer.style.fontFamily = "sans-serif";
      buttonContainer.style.position = "absolute";
      buttonContainer.style.zIndex = "999";
      buttonContainer.style.left = "0";
      buttonContainer.style.bottom = "0";
      buttonContainer.style.right = "0";
      buttonContainer.style.margin = "0";
      buttonContainer.style.padding = "0";
      buttonContainer.align = "right";
      document.body.appendChild(buttonContainer);
    }
    return buttonContainer;
  }

  function addButtonElement (message) {
    var buttonElement = document.createElement("div");
    buttonElement.classList.add = "vr-sample-button";
    buttonElement.style.color = "#FFF";
    buttonElement.style.fontWeight = "bold";
    buttonElement.style.backgroundColor = "#888";
    buttonElement.style.borderRadius = "5px";
    buttonElement.style.border = "3px solid #555";
    buttonElement.style.position = "relative";
    buttonElement.style.display = "inline-block";
    buttonElement.style.margin = "0.5em";
    buttonElement.style.padding = "0.75em";
    buttonElement.style.cursor = "pointer";
    buttonElement.align = "center";

    buttonElement.innerHTML = message;

    getButtonContainer().appendChild(buttonElement);

    return buttonElement;
  }

  var element = addButtonElement(message);
  element.addEventListener("click", function (event) {
    callback(event);
    event.preventDefault();
  }, false);
}

// load regl.
const canvas = document.body.appendChild(document.createElement('canvas'))
const fit = require('canvas-fit')
var gl = canvas.getContext('webgl', {
  antialias: true,
})
const regl = require('regl')({ gl: gl, })
window.addEventListener('resize', fit(canvas), false)

const normals = require('angle-normals')
const mat4 = require('gl-mat4')

// create box geometry.
var box = {}
box.positions = [
  // side faces
  [-0.5, +0.5, +0.5], [+0.5, +0.5, +0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5], // positive z face.
  [+0.5, +0.5, +0.5], [+0.5, +0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], // positive x face
  [+0.5, +0.5, -0.5], [-0.5, +0.5, -0.5], [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], // negative z face
  [-0.5, +0.5, -0.5], [-0.5, +0.5, +0.5], [-0.5, -0.5, +0.5], [-0.5, -0.5, -0.5], // negative x face.
  [-0.5, +0.5, -0.5], [+0.5, +0.5, -0.5], [+0.5, +0.5, +0.5], [-0.5, +0.5, +0.5],  // top face
  [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5]  // bottom face
]

box.cells = [
  [2, 1, 0], [2, 0, 3],
  [6, 5, 4], [6, 4, 7],
  [10, 9, 8], [10, 8, 11],
  [14, 13, 12], [14, 12, 15],
  [18, 17, 16], [18, 16, 19],
  [20, 21, 22], [23, 20, 22]
]

// scope that sets common settings of all rendering commands.
const globalScope = regl({
  vert: `
  precision mediump float;
  attribute vec3 position, normal;
  uniform mat4 view, projection, model;
  varying vec3 fsNormal, fsPosition;
  void main() {
    fsNormal = normal;
    fsPosition = (model * vec4(position, 1)).xyz;
    gl_Position = projection * view * model * vec4(position, 1);
  }`,

  frag: `
  precision mediump float;

  varying vec3 fsNormal, fsPosition;

  uniform vec3 color;

  void main() {
    vec3 normal = normalize(fsNormal);
    vec3 light = vec3(0, 0, 0);

    // we have a point-light source at (0,0,0)
    vec3 l = normalize(-fsPosition);
    vec3 n = normal;

    float ndotl = max(0.0, dot(l, n));
    light = ndotl * 0.6 * color + 0.3 * color;
    gl_FragColor = vec4(light, 1);
  }`,
})

var vrDisplay = null
var frameData = null

// each eye require a different viewport.
function calculateViewport ({drawingBufferWidth, drawingBufferHeight}, {eye}) {
  return {
    x: eye * drawingBufferWidth / 2,
    y: 0,
    width: drawingBufferWidth / 2,
    height: drawingBufferHeight
  }
}

// setups projection and view matrices and viewports depending on the eye.
const setEye = regl({
  context: {
    projection: ({}, { eye }) => {
      if (eye) {
        return frameData.rightProjectionMatrix
      } else {
        return frameData.leftProjectionMatrix
      }
    },
    view: ({}, { eye }) => {
      if (eye) {
        return frameData.rightViewMatrix
      } else {
        return frameData.leftViewMatrix
      }
    },
  },

  uniforms: {
    view: regl.context("view"),
    projection: regl.context("projection"),
  },

  viewport: calculateViewport,
  scissor: {
    enable: true,
    box: calculateViewport,
  },
})

const setCamera = regl({
  uniforms: {
    view: regl.prop("view"),
    projection: regl.prop("projection"),
  },
})

//need to use batching for this.
//and use polyfill vr

// command for drawing a single box.
const drawBox = regl({
  attributes: {
    position: box.positions,
    normal: normals(box.cells, box.positions)
  },

  elements: box.cells,

  uniforms: {
    // simple translation matrix.
    model: (_,props) => {
      var sx = props.scale[0]
      var sy = props.scale[1]
      var sz = props.scale[2]

      // translation
      var tx = props.pos[0]
      var ty = props.pos[1]
      var tz = props.pos[2]

      return [
        sx, 0.0, 0.0, 0.0,
        0.0, sy, 0.0, 0.0,
        0.0, 0.0, sz, 0.0,
        tx, ty, tz, 1.0,
      ]
    },
    color: regl.prop("color")
  }
})

function drawMeshes(tick) {
  var N = 25
  var PI = Math.PI

  // draw boxes, with random colors and scales and stuff.
  // the index variable is used as a seed.
  for(var i = 0; i < N; ++i) {

    var r = ((Math.abs(23232 * i * i + 100212) % 255) / 255) * 0.8452
    var g = ((Math.abs(32278 * i + 213) % 255) / 255) * 0.8523
    var b = ((Math.abs(3112 * i * i * i + 2137 + i) % 255) / 255) * 0.8523

    var sx = ((Math.abs(3024 * i + 5239 * (i%2) + 1321) % 50) / 50) * 5.1 + 2.4
    var sy = ((Math.abs(1291 * i + 3214 * (i%3) + 4621) % 70) / 70) * 5.0 + 2.7
    var sz = ((Math.abs(4912 * i + 5351 * (i%2) + 5623) % 60) / 60) * 5.1 + 2.9

    var yAmplitude = ((Math.abs(3024 * i + 52399 * (i%17) + 1321) % 50) / 50) * 5.1 + 2.4
    var yFrequency = ((Math.abs(36263 * i + 669823 * (i%6) + 962531) % 3) / 20) * 0.019 + 0.009
    var yPhase = ((Math.abs(933131 * i + 461581 * (i%82) + 349139) % 60) / 60) * 3.0 + 0.4

    var y = yAmplitude * Math.sin(yFrequency * tick + yPhase)

    drawBox({
      pos: [40.0 * Math.sin((i / N) * 2.0 *PI), y, 40.0 * Math.cos((i / N) * 2.0 *PI)],
      scale: [sx, sy, sz],
      color: [r, g, b]
    })
  }
}

function drawScene() {
  regl.clear({
    depth: 1,
    color: [1, 1, 1, 1]
  })
  globalScope(() => {
    setEye({eye: 0 }, ({tick}) => {
      drawMeshes(tick)
    })

    setEye({eye: 1 }, ({tick}) => {
      drawMeshes(tick)
    })
  })
}

var defaultFrame = null

function onVRRequestPresent() {
  function doVrRaf() {
    vrDisplay.getFrameData(frameData)
    drawScene()
    vrDisplay.submitFrame()

    regl.poll()
    vrDisplay.requestAnimationFrame(doVrRaf);
  }

  // cancel the default rendering, and replace with vr rendering.
  defaultFrame.cancel()

  frameData = new VRFrameData()

  // start our render loop.
  vrDisplay.requestPresent([{ source: regl._gl.canvas }])
  vrDisplay.requestAnimationFrame(doVrRaf);
}

navigator.getVRDisplays().then((vrDisplays) => {
  if (vrDisplays.length === 0) {
    addButton("No VR Available!",function() {});
    return
  } else {
    // note that you can only enter VR as the result of a user gesture.
    // it is NOT possible to simply enter VR as soon as the app starts.
    // so this button is absolutely necessary.
    addButton("Enter VR",onVRRequestPresent);
  }

  vrDisplay = vrDisplays[0]
  console.log(`VR display detected: ${vrDisplay.displayName}`)

}).catch((err) => {
  console.error(err)
})

  // we start with default render, until the user chooses to activivate VR.
  defaultFrame = regl.frame(() => {
    regl.clear({
      depth: 1,
      color: [1, 1, 1, 1]
    })
    globalScope(() => {
      setCamera({
        view: mat4.lookAt([], [-0.0, 0.0, 0.0], [1, 0.0, 0], [0, 1, 0]),
        projection: mat4.perspective([], Math.PI / 4, canvas.width / canvas.height, 0.01, 1000)
      }, ({tick}) => {
        drawMeshes(tick)
      })

    })
  })
