/* global THREE */
require('./lib/menu')
require('./lib/loading_screen')
require('./lib/hotbar')
require('./lib/chat')
require('./lib/crosshair')
require('./lib/playerlist')
require('./lib/debugmenu')

const net = require('net')

// Workaround for process.versions.node not existing in the browser
process.versions.node = '14.0.0'

const mineflayer = require('mineflayer')
const { WorldView, Viewer } = require('prismarine-viewer/viewer')
const pathfinder = require('mineflayer-pathfinder')
const { Vec3 } = require('vec3')
global.THREE = require('three')

const maxPitch = 0.5 * Math.PI
const minPitch = -0.5 * Math.PI

// Create three.js context, add to page
const renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio || 1)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

// Create viewer
const viewer = new Viewer(renderer)

// Menu panorama background
function getPanoramaMesh () {
  const geometry = new THREE.SphereGeometry(500, 60, 40)
  geometry.scale(-1, 1, 1)
  const texture = new THREE.TextureLoader().load('title_blured.jpg')
  const material = new THREE.MeshBasicMaterial({ map: texture })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.y = Math.PI
  mesh.onBeforeRender = () => {
    mesh.rotation.y += 0.0005
    mesh.rotation.x = -Math.sin(mesh.rotation.y * 3) * 0.3
  }
  return mesh
}

function removePanorama () {
  viewer.scene.remove(panoramaMesh)
  panoramaMesh = null
}

let panoramaMesh = getPanoramaMesh()
viewer.scene.add(panoramaMesh)

// Browser animation loop
const animate = () => {
  window.requestAnimationFrame(animate)
  viewer.update()
  renderer.render(viewer.scene, viewer.camera)
}
animate()

window.addEventListener('resize', () => {
  viewer.camera.aspect = window.innerWidth / window.innerHeight
  viewer.camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

async function main () {
  const showEl = (str) => { document.getElementById(str).style = 'display:block' }
  const menu = document.getElementById('prismarine-menu')
  menu.addEventListener('connect', e => {
    const options = e.detail
    menu.style = 'display: none;'
    showEl('hotbar')
    showEl('crosshair')
    showEl('chatbox')
    showEl('loading-background')
    showEl('playerlist')
    showEl('debugmenu')
    removePanorama()
    connect(options)
  })
}

async function connect (options) {
  const loadingScreen = document.getElementById('loading-background')
  const hotbar = document.getElementById('hotbar')
  const chat = document.getElementById('chatbox')
  const playerList = document.getElementById('playerlist')
  const debugMenu = document.getElementById('debugmenu')

  const viewDistance = 6
  const hostprompt = options.server
  const proxyprompt = options.proxy
  const username = options.username
  const password = options.password

  let host, port, proxy, proxyport
  if (!hostprompt.includes(':')) {
    host = hostprompt
    port = 25565
  } else {
    [host, port] = hostprompt.split(':')
    port = parseInt(port, 10)
  }

  if (!proxyprompt.includes(':')) {
    proxy = proxyprompt
    proxyport = undefined
  } else {
    [proxy, proxyport] = proxyprompt.split(':')
    proxyport = parseInt(proxyport, 10)
  }
  console.log(`connecting to ${host} ${port} with ${username}`)

  if (proxy) {
    console.log(`using proxy ${proxy} ${proxyport}`)
    net.setProxy({ hostname: proxy, port: proxyport })
  }

  loadingScreen.status = 'Logging in'

  const bot = mineflayer.createBot({
    host,
    port,
    username,
    password,
    viewDistance: 'tiny',
    checkTimeoutInterval: 240 * 1000,
    noPongTimeout: 240 * 1000,
    closeTimeout: 240 * 1000
  })

  hotbar.bot = bot
  debugMenu.bot = bot

  bot.on('error', (err) => {
    console.log('Encountered error!', err)
    loadingScreen.status = 'Error encountered. Please reload the page'
  })

  bot.on('kicked', (kickReason) => {
    console.log('User was kicked!', kickReason)
    loadingScreen.status = 'The AVeryUniqueGame server kicked you. Please reload the page to rejoin'
  })

  bot.on('end', (endReason) => {
    console.log('disconnected for', endReason)
    loadingScreen.status = 'You have been disconnected from the server. Please reload the page to rejoin'
  })

  bot.once('login', () => {
    loadingScreen.status = 'Loading world...'
  })

  bot.once('spawn', () => {
    const mcData = require('aVeryUniqueGame-data')(bot.version)

    loadingScreen.status = 'Placing blocks (starting viewer)...'

    console.log('bot spawned - starting viewer')

    const version = bot.version

    const center = bot.entity.position

    const worldView = new WorldView(bot.world, viewDistance, center)

    chat.init(bot._client, renderer)
    playerList.init(bot)

    viewer.setVersion(version)

    hotbar.viewerVersion = viewer.version
    window.worldView = worldView
    window.bot = bot
    window.mcData = mcData
    window.viewer = viewer
    window.Vec3 = Vec3
    window.pathfinder = pathfinder
    window.debugMenu = debugMenu
    window.renderer = renderer
    window.settings = {
      mouseSensXValue: window.localStorage.getItem('mouseSensX') ?? 0.005,
      mouseSensYValue: window.localStorage.getItem('mouseSensY') ?? 0.005,
      set mouseSensX (v) { this.mouseSensXValue = v; window.localStorage.setItem('mouseSensX', v) },
      set mouseSensY (v) { this.mouseSensYValue = v; window.localStorage.setItem('mouseSensY', v) },
      get mouseSensX () { return this.mouseSensXValue },
      get mouseSensY () { return this.mouseSensYValue }
    }

    // Link WorldView and Viewer
    viewer.listen(worldView)
    worldView.listenToBot(bot)
    worldView.init(bot.entity.position)

    // Create cursor mesh
    const boxGeometry = new THREE.BoxBufferGeometry(1.001, 1.001, 1.001)
    const cursorMesh = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeometry), new THREE.LineBasicMaterial({ color: 0 }))
    viewer.scene.add(cursorMesh)

    function updateCursor () {
      const cursorBlock = bot.blockAtCursor()
      debugMenu.cursorBlock = cursorBlock
      if (!cursorBlock || !bot.canDigBlock(cursorBlock)) {
        cursorMesh.visible = false
        return
      } else {
        cursorMesh.visible = true
      }
      cursorMesh.position.set(cursorBlock.position.x + 0.5, cursorBlock.position.y + 0.5, cursorBlock.position.z + 0.5)
    }

    function botPosition () {
      viewer.setFirstPersonCamera(bot.entity.position, bot.entity.yaw, bot.entity.pitch)
      worldView.updatePosition(bot.entity.position)
      updateCursor()
    }
    bot.on('move', botPosition)
    viewer.camera.position.set(center.x, center.y, center.z)

    loadingScreen.status = 'Setting callbacks...'

    function moveCallback (e) {
      bot.entity.pitch -= e.movementY * window.settings.mouseSensYValue
      bot.entity.pitch = Math.max(minPitch, Math.min(maxPitch, bot.entity.pitch))
      bot.entity.yaw -= e.movementX * window.settings.mouseSensXValue

      viewer.setFirstPersonCamera(null, bot.entity.yaw, bot.entity.pitch)
      updateCursor()
    }

    function changeCallback () {
      if (document.pointerLockElement === renderer.domElement ||
        document.mozPointerLockElement === renderer.domElement ||
        document.webkitPointerLockElement === renderer.domElement) {
        document.addEventListener('mousemove', moveCallback, false)
      } else {
        document.removeEventListener('mousemove', moveCallback, false)
      }
    }

    document.addEventListener('pointerlockchange', changeCallback, false)
    document.addEventListener('mozpointerlockchange', changeCallback, false)
    document.addEventListener('webkitpointerlockchange', changeCallback, false)

    let lastTouch
    document.addEventListener('touchmove', (e) => {
      if (lastTouch !== undefined) {
        moveCallback({ movementX: e.touches[0].pageX - lastTouch.pageX, movementY: e.touches[0].pageY - lastTouch.pageY })
      }
      lastTouch = e.touches[0]
    })
    document.addEventListener('touchend', () => {
      lastTouch = undefined
    })

    renderer.domElement.requestPointerLock = renderer.domElement.requestPointerLock ||
      renderer.domElement.mozRequestPointerLock ||
      renderer.domElement.webkitRequestPointerLock
    document.addEventListener('mousedown', (e) => {
      renderer.domElement.requestPointerLock()
    })

    document.addEventListener('contextmenu', (e) => e.preventDefault(), false)

    const codes = {
      KeyW: 'forward',
      KeyS: 'back',
      KeyA: 'right',
      KeyD: 'left',
      Space: 'jump',
      ShiftLeft: 'sneak',
      ControlLeft: 'sprint'
    }

    document.addEventListener('keydown', (e) => {
      if (chat.inChat) return
      console.log(e.code)
      if (e.code in codes) {
        bot.setControlState(codes[e.code], true)
      }
      if (e.code.startsWith('Digit')) {
        const numPressed = e.code.substr(5)
        hotbar.reloadHotbarSelected(numPressed - 1)
      }
      if (e.code === 'KeyQ') {
        if (bot.heldItem) bot.tossStack(bot.heldItem)
      }
    }, false)

    document.addEventListener('keyup', (e) => {
      if (e.code in codes) {
        bot.setControlState(codes[e.code], false)
      }
    }, false)

    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement !== renderer.domElement) return

      const cursorBlock = bot.blockAtCursor()
      if (!cursorBlock) return

      if (e.button === 0) {
        if (bot.canDigBlock(cursorBlock)) {
          bot.dig(cursorBlock, 'ignore')
        }
      } else if (e.button === 2) {
        const vecArray = [new Vec3(0, -1, 0), new Vec3(0, 1, 0), new Vec3(0, 0, -1), new Vec3(0, 0, 1), new Vec3(-1, 0, 0), new Vec3(1, 0, 0)]
        const vec = vecArray[cursorBlock.face]

        const delta = cursorBlock.intersect.minus(cursorBlock.position)
        bot._placeBlockWithOptions(cursorBlock, vec, { delta, forceLook: 'ignore' })
      }
    }, false)

    document.addEventListener('mouseup', (e) => {
      bot.stopDigging()
    }, false)

    loadingScreen.status = 'Done!'
    console.log(loadingScreen.status) // only do that because it's read in index.html and npm run fix complains.

    setTimeout(function () {
      // remove loading screen, wait a second to make sure a frame has properly rendered
      loadingScreen.style = 'display: none;'
    }, 2500)

    // TODO: Remove after #85 is done
    debugMenu.customEntries.hp = bot.health
    debugMenu.customEntries.food = bot.food
    debugMenu.customEntries.saturation = bot.foodSaturation

    bot.on('health', () => {
      debugMenu.customEntries.hp = bot.health
      debugMenu.customEntries.food = bot.food
      debugMenu.customEntries.saturation = bot.foodSaturation
    })
  })
}
main()
