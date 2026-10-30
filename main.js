async function onAssetsLoaded() {
    await document.fonts.load("16px 'Press Start 2P'")

    assetsReady = true
    resetGame()
}

const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

const GAME_WIDTH = 800
const GAME_HEIGHT = 600

canvas.width = GAME_WIDTH
canvas.height = GAME_HEIGHT

// Keep pixel art crisp instead of letting the browser smooth scaled sprites.
ctx.imageSmoothingEnabled = false

// Size of one "chunky" pixel for effects, shadows, rain and smoke.
const PIXEL_SIZE = 4
const FONT = "'Press Start 2P', monospace"

const playerImage = new Image()
playerImage.src = './src/assets/player.png'

const obstacleImage = new Image()
obstacleImage.src = './src/assets/banana.png'

const treeImage = new Image()
treeImage.src = './src/assets/tree.png'

const enemyImage = new Image()
enemyImage.src = './src/assets/enemy.png'

const safetyCarImage = new Image()
safetyCarImage.src = './src/assets/safetycar.png'

let imagesLoaded = 0
const totalImages = 5
let assetsReady = false

function onImageLoad() {
    imagesLoaded++

    if (imagesLoaded === totalImages) {
        onAssetsLoaded()
    }
}

function onImageError(e) {
    console.error('Failed to load image:', e.target.src)
    ctx.fillStyle = '#f1f1f1ff'
    ctx.font = '24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Failed to load assets', GAME_WIDTH / 2, GAME_HEIGHT / 2)
}

for (const image of [
    playerImage,
    obstacleImage,
    treeImage,
    enemyImage,
    safetyCarImage,
]) {
    image.onload = onImageLoad
    image.onerror = onImageError
}

const FRAME_DURATION = 1000 / 60
const MAX_DELTA = 3
let lastFrameTime = 0
let animationFrameId = null

const INITIAL_PLAYER_STATE = {
    width: 48,
    height: 64,
    x: GAME_WIDTH / 2 - 24,
    y: GAME_HEIGHT - 64 - 16,
    speed: 2.75,
}

const PLAYER_RAIN_SPEED = 3.75

const INITIAL_ROAD_STATE = {
    width: 320,
    segmentHeight: 32,
    speed: 2.25,
    color: '#888',
    shoulderColor: '#437a55ff',
}

const MAX_ROAD_SPEED = 5

let player = { ...INITIAL_PLAYER_STATE }
let road = { ...INITIAL_ROAD_STATE }

const MIN_WIDTH_CHANGE = -16
const MAX_WIDTH_CHANGE = 16
const MAX_OFFSET_CHANGE = 24

const pressedKeys = {}

let roadSegments = []
// The road is generated this far above the screen, so new objects can be
// placed on segments that already exist instead of guessing the road ahead.
const ROAD_LOOKAHEAD = 256
const MAX_ROAD_WIDTH = 448
const MIN_ROAD_WIDTH = 288
let shouldDrawDash = true

let obstacles = []
// Only two fixed sizes, so every banana is scaled the same way.
const OBSTACLE_SMALL_SIZE = 32
const OBSTACLE_LARGE_SIZE = 48
const OBSTACLE_LARGE_CHANCE = 0.5
const INITIAL_OBSTACLE_SPAWN_INTERVAL = 32
let obstacle_spawn_interval = INITIAL_OBSTACLE_SPAWN_INTERVAL
const MIN_OBSTACLE_SPAWN_INTERVAL = 8
let segmentsSinceLastObstacle = 0

let enemies = []
const ENEMY_WIDTH = 48
const ENEMY_HEIGHT = 64
const INITIAL_ENEMY_SPAWN_INTERVAL = 48
let enemy_spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL
const MIN_ENEMY_SPAWN_INTERVAL = 32
let segmentsSinceLastEnemy = 0

const PLAYER_DETECTION_RADIUS = 128

const COLLISION_TOLERANCE = 6

const TREE_SPAWN_INTERVAL = 8
let segmentsSinceLastTree = 0
const TREE_WIDTH = 64
const TREE_HEIGHT = 64
let trees = []

let ripples = []
const RIPPLE_SPAWN_INTERVAL = 1
let segmentsSinceLastRipple = 0

const RIPPLE_SHOULDER_PADDING = 8
const RIPPLE_ROAD_BUFFER = 8

// Small fixed palettes instead of random translucent colors, like the
// limited color sets of old arcade hardware.
const ROAD_RIPPLE_COLORS = ['#7a7a7a', '#949494', '#6e6e6e']
const SHOULDER_RIPPLE_COLORS = ['#3a6b4a', '#4f8a5f', '#5c4a32', '#36603f']

let safetyCar = null
const SAFETY_CAR_ENTRY_DURATION = 90
const SAFETY_CAR_SWAY_SPEED = 0.03
const SAFETY_CAR_LOOK_AHEAD = 48
const SAFETY_CAR_BOB_SPEED = 0.02
const SAFETY_CAR_BOB_DISTANCE = 12

let score = 0
let highScore = parseInt(localStorage.getItem('highScore')) || 0
let newHighScoreAchieved = false
let isGameOver = false
let gameStarted = false
let speedIncreasedForThisMilestone = false

const RAIN_COLOR = '#9cd6e9'
const RAIN_COUNT = 192
const RAIN_SPEED_MIN = 8
const RAIN_SPEED_MAX = 16
const RAIN_LENGTH_MIN = 16
const RAIN_LENGTH_MAX = 32
const RAIN_ANGLE = Math.PI / 16
const RAIN_DIRECTION_X = Math.sin(RAIN_ANGLE)
const RAIN_DIRECTION_Y = Math.cos(RAIN_ANGLE)

let rainDrops = []
let isRaining = false
let rainToggleTimer = 0
let isTransitioningRain = false
let rainTargetCount = RAIN_COUNT
let currentRainCount = 0
let rainFilterOpacity = 0
const RAIN_FILTER_FADE_SPEED = 0.005
const RAIN_FILTER_MAX_OPACITY = 0.4
// Old hardware faded palettes in a few hard steps rather than smoothly.
const RAIN_FILTER_STEP = 0.1

let smokeParticles = []
// Opaque puffs that get lighter as they dissolve, from young to old.
const SMOKE_COLORS = ['#4a4a4a', '#6a6a6a', '#8c8c8c']
const SMOKE_FADE_SPEED = 0.008
const SMOKE_GROW_SPEED = 0.2
const SMOKE_MIN_SIZE = 4
const SMOKE_MAX_SIZE = 12
const SMOKE_PARTICLES_PER_FRAME = 0.5
const MAX_SMOKE_PARTICLES = 200

const BLINK_INTERVAL = 500
const TEXT_COLOR = '#f1f1f1'
const TEXT_SHADOW_COLOR = '#000000'
const TITLE_COLOR = '#ffd800'
const TITLE_SHADOW_COLOR = '#c00000'
const LABEL_COLOR = '#ff4040'

function snapToPixel(value) {
    return Math.round(value / PIXEL_SIZE) * PIXEL_SIZE
}

// Hard-edged ellipse on the chunky pixel grid. Dithered sprites only fill every
// other block (checkerboard), the classic way to fake transparent shadows on
// hardware without alpha blending.
function createPixelEllipseSprite(radiusX, radiusY, color, isDithered) {
    const columns = Math.max(1, Math.round((radiusX * 2) / PIXEL_SIZE))
    const rows = Math.max(1, Math.round((radiusY * 2) / PIXEL_SIZE))
    const sprite = document.createElement('canvas')
    sprite.width = columns * PIXEL_SIZE
    sprite.height = rows * PIXEL_SIZE

    const spriteCtx = sprite.getContext('2d')
    spriteCtx.fillStyle = color
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const nx = (column + 0.5 - columns / 2) / (columns / 2)
            const ny = (row + 0.5 - rows / 2) / (rows / 2)
            const isInside = nx * nx + ny * ny <= 1
            const isDitherGap = isDithered && (row + column) % 2 === 1
            if (isInside && !isDitherGap) {
                spriteCtx.fillRect(
                    column * PIXEL_SIZE,
                    row * PIXEL_SIZE,
                    PIXEL_SIZE,
                    PIXEL_SIZE
                )
            }
        }
    }
    return sprite
}

// Three blocks wide exhaust flame: yellow core, orange edges, tapered tip.
function createFlameSprite(length) {
    const sprite = document.createElement('canvas')
    sprite.width = PIXEL_SIZE * 3
    sprite.height = PIXEL_SIZE * length

    const spriteCtx = sprite.getContext('2d')
    for (let row = 0; row < length; row++) {
        const y = row * PIXEL_SIZE
        if (row < length - 1) {
            spriteCtx.fillStyle = '#ff5500'
            spriteCtx.fillRect(0, y, PIXEL_SIZE, PIXEL_SIZE)
            spriteCtx.fillRect(PIXEL_SIZE * 2, y, PIXEL_SIZE, PIXEL_SIZE)
            spriteCtx.fillStyle = '#ffd800'
        } else {
            spriteCtx.fillStyle = '#ff5500'
        }
        spriteCtx.fillRect(PIXEL_SIZE, y, PIXEL_SIZE, PIXEL_SIZE)
    }
    return sprite
}

function createDitherOverlaySprite() {
    const sprite = document.createElement('canvas')
    sprite.width = GAME_WIDTH
    sprite.height = GAME_HEIGHT

    const spriteCtx = sprite.getContext('2d')
    spriteCtx.fillStyle = '#000000'
    for (let y = 0; y < GAME_HEIGHT; y += PIXEL_SIZE) {
        const offset = (y / PIXEL_SIZE) % 2 === 0 ? 0 : PIXEL_SIZE
        for (let x = offset; x < GAME_WIDTH; x += PIXEL_SIZE * 2) {
            spriteCtx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE)
        }
    }
    return sprite
}

function createScanlinesSprite() {
    const sprite = document.createElement('canvas')
    sprite.width = GAME_WIDTH
    sprite.height = GAME_HEIGHT

    const spriteCtx = sprite.getContext('2d')
    spriteCtx.fillStyle = 'rgba(0, 0, 0, 0.15)'
    for (let y = 0; y < GAME_HEIGHT; y += 8) {
        spriteCtx.fillRect(0, y, GAME_WIDTH, 2)
    }
    return sprite
}

// All shadows and effects are pre-rendered once and only copied with drawImage.
const CAR_SHADOW_SPRITE = createPixelEllipseSprite(
    ENEMY_WIDTH / 2.4,
    12,
    '#000000',
    true
)
const OBSTACLE_SHADOW_COLOR = '#3c3c3c'
const OBSTACLE_SHADOW_SPRITES = {
    [OBSTACLE_SMALL_SIZE]: createPixelEllipseSprite(
        OBSTACLE_SMALL_SIZE / 2.4,
        8,
        OBSTACLE_SHADOW_COLOR,
        true
    ),
    [OBSTACLE_LARGE_SIZE]: createPixelEllipseSprite(
        OBSTACLE_LARGE_SIZE / 2.4,
        10,
        OBSTACLE_SHADOW_COLOR,
        true
    ),
}
const TREE_SHADOW_SPRITE = createPixelEllipseSprite(
    TREE_WIDTH / 1.8,
    12,
    '#24452f',
    true
)
// Two flame lengths that alternate for a flickering exhaust.
const FLAME_SPRITES = [createFlameSprite(2), createFlameSprite(3)]
const DITHER_OVERLAY_SPRITE = createDitherOverlaySprite()
const SCANLINES_SPRITE = createScanlinesSprite()

function drawCenteredSprite(sprite, centerX, centerY) {
    ctx.drawImage(
        sprite,
        snapToPixel(centerX - sprite.width / 2),
        Math.round(centerY - sprite.height / 2)
    )
}

function isBlinkOn() {
    return Math.floor(performance.now() / BLINK_INTERVAL) % 2 === 0
}

function drawExhaustFlame(car, roundedY) {
    const flame = FLAME_SPRITES[Math.floor(performance.now() / 80) % 2]
    ctx.drawImage(
        flame,
        Math.round(car.x + car.width / 2 - flame.width / 2),
        roundedY + car.height - PIXEL_SIZE
    )
}

function drawPixelText(text, x, y, color, shadowColor = TEXT_SHADOW_COLOR) {
    ctx.fillStyle = shadowColor
    ctx.fillText(text, x + PIXEL_SIZE, y + PIXEL_SIZE)
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
}

function drawPanel(x, y, width, height) {
    ctx.fillStyle = TEXT_COLOR
    ctx.fillRect(
        x - PIXEL_SIZE,
        y - PIXEL_SIZE,
        width + PIXEL_SIZE * 2,
        height + PIXEL_SIZE * 2
    )
    ctx.fillStyle = '#000000'
    ctx.fillRect(x, y, width, height)
}

function formatScore(value) {
    return String(value).padStart(6, '0')
}

function startLoop() {
    cancelAnimationFrame(animationFrameId)
    lastFrameTime = performance.now()
    gameLoop()
}

function resetGame() {
    player = { ...INITIAL_PLAYER_STATE }
    road = { ...INITIAL_ROAD_STATE }

    roadSegments = createInitialRoadSegments()

    obstacles = []
    trees = []
    segmentsSinceLastTree = 0
    score = 0
    segmentsSinceLastObstacle = 0
    obstacle_spawn_interval = INITIAL_OBSTACLE_SPAWN_INTERVAL
    isGameOver = false
    newHighScoreAchieved = false
    speedIncreasedForThisMilestone = false
    ripples = []
    segmentsSinceLastRipple = 0
    enemies = []
    enemy_spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL
    segmentsSinceLastEnemy = 0
    rainDrops = []
    isRaining = false
    isTransitioningRain = false
    currentRainCount = 0
    rainTargetCount = 0
    rainFilterOpacity = 0
    scheduleNextRainToggle()
    smokeParticles = []
    safetyCar = null

    startLoop()
}

document.addEventListener('keydown', (e) => {
    pressedKeys[e.key] = true
    if (!assetsReady || e.key !== ' ' || e.repeat) {
        return
    }
    if (isGameOver) {
        resetGame()
    } else if (!gameStarted) {
        gameStarted = true
        startLoop()
    }
})

document.addEventListener('keyup', (e) => {
    pressedKeys[e.key] = false
})

function checkCollision(a, b) {
    const t = COLLISION_TOLERANCE

    return (
        a.x + t < b.x + b.width - t &&
        a.x + a.width - t > b.x + t &&
        a.y + t < b.y + b.height - t &&
        a.y + a.height - t > b.y + t
    )
}

function checkNewHighScore() {
    if (score > highScore) {
        highScore = score
        localStorage.setItem('highScore', highScore)
        newHighScoreAchieved = true
    }
}

function createInitialRoadSegments() {
    let segments = []
    const bottomSegmentY =
        (Math.ceil(GAME_HEIGHT / road.segmentHeight) - 1) * road.segmentHeight
    const initialSegmentsCount = Math.ceil(
        (GAME_HEIGHT + ROAD_LOOKAHEAD) / road.segmentHeight
    )
    const initialRoadWidth = INITIAL_ROAD_STATE.width
    const initialRoadX = (GAME_WIDTH - initialRoadWidth) / 2

    shouldDrawDash = true

    // Ordered bottom to top: new segments are always appended above the last one.
    for (let i = 0; i < initialSegmentsCount; i++) {
        segments.push({
            y: bottomSegmentY - i * road.segmentHeight,
            width: initialRoadWidth,
            x: initialRoadX,
            shoulderStripeColor: i % 2 === 0 ? '#f50000ff' : '#f1f1f1ff',
            isDashed: shouldDrawDash,
        })
        shouldDrawDash = !shouldDrawDash
    }
    return segments
}

function createSafetyCar() {
    const spawnY = -ENEMY_HEIGHT
    const spawnSegment = getSegmentAt(spawnY + ENEMY_HEIGHT / 2)

    return {
        // Start on the road center, not the screen center, which can be far
        // off the road and made the car slide across the track while entering.
        x: spawnSegment.x + spawnSegment.width / 2 - ENEMY_WIDTH / 2,
        y: spawnY,
        targetY: 144,
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        state: 'entering',
        entryStartY: -ENEMY_HEIGHT,
        entryProgress: 0,
        swayTime: 0,
        bobTime: 0,
    }
}

function drawEnemies() {
    for (const enemy of enemies) {
        const roundedY = Math.round(enemy.y)
        // Crashed cars shake sideways instead of rotating: rotated sprites
        // would smear the pixel art.
        const shakeOffset = enemy.isCrashing
            ? (Math.floor(performance.now() / 60) % 2) * 4 - 2
            : 0
        const x = Math.round(enemy.x) + shakeOffset

        drawCenteredSprite(
            CAR_SHADOW_SPRITE,
            x + enemy.width / 2,
            roundedY + enemy.height - 8
        )
        drawExhaustFlame({ ...enemy, x: x }, roundedY)
        ctx.drawImage(enemyImage, x, roundedY, enemy.width, enemy.height)
    }
}

function drawGameOver() {
    ctx.drawImage(DITHER_OVERLAY_SPRITE, 0, 0)
    drawPanel(112, 152, GAME_WIDTH - 224, 296)

    ctx.textAlign = 'center'
    ctx.font = `48px ${FONT}`
    drawPixelText(
        'GAME OVER',
        GAME_WIDTH / 2,
        232,
        TITLE_COLOR,
        TITLE_SHADOW_COLOR
    )

    ctx.font = `24px ${FONT}`
    drawPixelText('SCORE', GAME_WIDTH / 2, 288, LABEL_COLOR)
    drawPixelText(formatScore(score), GAME_WIDTH / 2, 320, TEXT_COLOR)

    if (newHighScoreAchieved) {
        if (isBlinkOn()) {
            drawPixelText('NEW HI-SCORE!', GAME_WIDTH / 2, 368, TITLE_COLOR)
        }
    } else {
        drawPixelText(
            'HI-SCORE ' + formatScore(highScore),
            GAME_WIDTH / 2,
            368,
            TEXT_COLOR
        )
    }

    if (isBlinkOn()) {
        ctx.font = `16px ${FONT}`
        drawPixelText('PRESS SPACE TO RESTART', GAME_WIDTH / 2, 416, TEXT_COLOR)
    }
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        const roundedY = Math.round(obstacle.y)
        const x = Math.round(obstacle.x)
        drawCenteredSprite(
            OBSTACLE_SHADOW_SPRITES[obstacle.width],
            x + obstacle.width / 2,
            // Centered on the bottom edge so the shadow peeks out below the
            // banana instead of showing only a few blocks between its gaps.
            roundedY + obstacle.height
        )

        ctx.drawImage(
            obstacleImage,
            x,
            roundedY,
            obstacle.width,
            obstacle.height
        )
    }
}

function drawPlayer() {
    const roundedPlayerY = Math.round(player.y)
    const x = Math.round(player.x)

    drawExhaustFlame({ ...player, x: x }, roundedPlayerY)
    ctx.drawImage(playerImage, x, roundedPlayerY, player.width, player.height)
}

// Each drop is a staircase of small blocks instead of an anti-aliased line.
function drawRain() {
    if (rainDrops.length === 0 && !isTransitioningRain) return

    ctx.fillStyle = RAIN_COLOR
    for (const drop of rainDrops) {
        const steps = Math.round(drop.length / PIXEL_SIZE)
        for (let i = 0; i < steps; i++) {
            ctx.fillRect(
                snapToPixel(drop.x - RAIN_DIRECTION_X * i * PIXEL_SIZE),
                snapToPixel(drop.y - RAIN_DIRECTION_Y * i * PIXEL_SIZE),
                PIXEL_SIZE / 2,
                PIXEL_SIZE
            )
        }
    }
}

function drawRainFilter() {
    const steppedOpacity =
        Math.round(rainFilterOpacity / RAIN_FILTER_STEP) * RAIN_FILTER_STEP
    if (steppedOpacity > 0) {
        ctx.fillStyle = `rgba(0, 0, 50, ${steppedOpacity.toFixed(1)})`
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    }
}

function drawRipples() {
    for (const ripple of ripples) {
        ctx.fillStyle = ripple.color
        ctx.fillRect(ripple.x, Math.round(ripple.y), ripple.size, ripple.size)
    }
}

function drawScores() {
    const displayedHighScore = Math.max(score, highScore)
    const hasNewHighScore = score > highScore
    const boxWidth = 176
    const boxHeight = 64
    const top = 8

    ctx.font = `16px ${FONT}`
    ctx.textAlign = 'center'

    ctx.fillStyle = '#000000'
    ctx.fillRect(8, top, boxWidth, boxHeight)
    drawPixelText('HI-SCORE', 8 + boxWidth / 2, top + 26, LABEL_COLOR)
    drawPixelText(
        formatScore(displayedHighScore),
        8 + boxWidth / 2,
        top + 54,
        hasNewHighScore ? TITLE_COLOR : TEXT_COLOR
    )

    const scoreBoxX = GAME_WIDTH - boxWidth - 8
    ctx.fillStyle = '#000000'
    ctx.fillRect(scoreBoxX, top, boxWidth, boxHeight)
    drawPixelText('SCORE', scoreBoxX + boxWidth / 2, top + 26, LABEL_COLOR)
    drawPixelText(
        formatScore(score),
        scoreBoxX + boxWidth / 2,
        top + 54,
        TEXT_COLOR
    )
}

function drawSegments() {
    for (const segment of roadSegments) {
        const roundedY = Math.round(segment.y)

        ctx.fillStyle = road.shoulderColor
        ctx.fillRect(0, roundedY, segment.x, road.segmentHeight)

        ctx.fillRect(
            segment.x + segment.width,
            roundedY,
            GAME_WIDTH - (segment.x + segment.width),
            road.segmentHeight
        )

        const shoulderStripeWidth = 8
        ctx.fillStyle = segment.shoulderStripeColor
        ctx.fillRect(
            segment.x - shoulderStripeWidth,
            roundedY,
            shoulderStripeWidth,
            road.segmentHeight
        )
        ctx.fillRect(
            segment.x + segment.width,
            roundedY,
            shoulderStripeWidth,
            road.segmentHeight
        )

        ctx.fillStyle = road.color
        ctx.fillRect(segment.x, roundedY, segment.width, road.segmentHeight)
    }

    ctx.fillStyle = TEXT_COLOR
    for (const segment of roadSegments) {
        if (segment.isDashed) {
            ctx.fillRect(
                snapToPixel(segment.x + segment.width / 2) - 4,
                Math.round(segment.y),
                8,
                24
            )
        }
    }
}

function drawStartScreen() {
    ctx.drawImage(DITHER_OVERLAY_SPRITE, 0, 0)

    ctx.textAlign = 'center'
    ctx.font = `48px ${FONT}`
    drawPixelText(
        'ARCADE RACING',
        GAME_WIDTH / 2,
        200,
        TITLE_COLOR,
        TITLE_SHADOW_COLOR
    )

    drawPanel(144, 248, GAME_WIDTH - 288, 192)

    ctx.font = `24px ${FONT}`
    if (isBlinkOn()) {
        drawPixelText('PRESS SPACE', GAME_WIDTH / 2, 296, TEXT_COLOR)
    }

    ctx.font = `16px ${FONT}`
    drawPixelText('ARROW KEYS TO STEER', GAME_WIDTH / 2, 344, TEXT_COLOR)

    drawPixelText('HI-SCORE', GAME_WIDTH / 2, 392, LABEL_COLOR)
    drawPixelText(formatScore(highScore), GAME_WIDTH / 2, 420, TEXT_COLOR)
}

function drawSmokeParticles() {
    for (const particle of smokeParticles) {
        const age = Math.min(
            SMOKE_COLORS.length - 1,
            Math.floor((1 - particle.alpha) * SMOKE_COLORS.length)
        )
        const size = Math.max(PIXEL_SIZE, snapToPixel(particle.size))
        ctx.fillStyle = SMOKE_COLORS[age]
        ctx.fillRect(
            snapToPixel(particle.x - size / 2),
            snapToPixel(particle.y - size / 2),
            size,
            size
        )
    }
}

function drawTrees() {
    for (const tree of trees) {
        const roundedY = Math.round(tree.y)
        const x = Math.round(tree.x)
        drawCenteredSprite(
            TREE_SHADOW_SPRITE,
            x + tree.width / 2,
            roundedY + tree.height - 8
        )

        ctx.drawImage(treeImage, x, roundedY, tree.width, tree.height)
    }
}

function enemyCollision(enemy, obj) {
    if (!enemy.isCrashing) {
        enemy.isCrashing = true
        enemy.waveAmplitude = 0
        enemy.waveFrequency = 0
        enemy.targetX = enemy.x
        enemy.baseX = enemy.x
        enemy.isSmoking = true
        enemy.smokeAccumulator = 0
    }
}

function generateSmokeParticle(x, y) {
    const size =
        Math.random() * (SMOKE_MAX_SIZE - SMOKE_MIN_SIZE) + SMOKE_MIN_SIZE
    return {
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        size: size,
        alpha: 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 1.2) * 0.3 - 0.5,
        initialSize: size,
    }
}

function getRandomColor(colors) {
    return colors[Math.floor(Math.random() * colors.length)]
}

function generateEnemyCar() {
    const y = -ENEMY_HEIGHT - Math.random() * 192
    const roadSegment = getSegmentAt(y + ENEMY_HEIGHT / 2)
    const safeMargin = 16
    const availableWidth = roadSegment.width - ENEMY_WIDTH - safeMargin * 2
    const baseX = roadSegment.x + safeMargin + Math.random() * availableWidth
    const waveAmplitude = Math.random() * 16 + 8 + (isRaining ? 4 : 0)
    const waveFrequency = Math.random() * 0.03 + 0.02 + (isRaining ? 0.005 : 0)

    return {
        baseX: baseX,
        x: baseX,
        y: y,
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        isCrashing: false,
        speedY: road.speed - 0.75 - Math.random() + (isRaining ? 0.125 : 0),
        targetX: baseX,
        time: Math.random() * 1000,
        waveAmplitude: waveAmplitude,
        waveFrequency: waveFrequency,
        originalWaveAmplitude: waveAmplitude,
        originalWaveFrequency: waveFrequency,
    }
}

function generateRaindrop() {
    const speed =
        Math.random() * (RAIN_SPEED_MAX - RAIN_SPEED_MIN) + RAIN_SPEED_MIN
    const length =
        Math.random() * (RAIN_LENGTH_MAX - RAIN_LENGTH_MIN) + RAIN_LENGTH_MIN

    const extendedWidth = GAME_WIDTH * 1.4
    const startX =
        Math.random() * extendedWidth - (extendedWidth - GAME_WIDTH) / 2

    return {
        x: startX,
        y: 0,
        speed: speed,
        length: length,
    }
}

// Ripples are single chunky pixels (sometimes double size) on the pixel grid.
function generateRipple(roadSegment) {
    const rippleSize = Math.random() < 0.8 ? PIXEL_SIZE : PIXEL_SIZE * 2

    let rippleColor
    const minSpawnX = 0 + RIPPLE_SHOULDER_PADDING
    const maxSpawnX = GAME_WIDTH - RIPPLE_SHOULDER_PADDING - rippleSize

    const rippleX = snapToPixel(
        Math.random() * (maxSpawnX - minSpawnX) + minSpawnX
    )

    const roadLeftEdge = roadSegment.x
    const roadRightEdge = roadSegment.x + roadSegment.width

    if (
        rippleX + rippleSize > roadLeftEdge + RIPPLE_ROAD_BUFFER &&
        rippleX < roadRightEdge - RIPPLE_ROAD_BUFFER
    ) {
        rippleColor = getRandomColor(ROAD_RIPPLE_COLORS)
    } else {
        rippleColor = getRandomColor(SHOULDER_RIPPLE_COLORS)
    }

    const rippleY =
        roadSegment.y + Math.random() * (road.segmentHeight - rippleSize)

    return {
        x: rippleX,
        y: rippleY,
        size: rippleSize,
        color: rippleColor,
    }
}

function generateRoadSegment(previousSegment) {
    let newWidth =
        previousSegment.width +
        (Math.random() * (MAX_WIDTH_CHANGE - MIN_WIDTH_CHANGE) +
            MIN_WIDTH_CHANGE)
    newWidth = Math.max(Math.min(MAX_ROAD_WIDTH, newWidth), MIN_ROAD_WIDTH)

    let newX =
        previousSegment.x +
        (Math.random() * (MAX_OFFSET_CHANGE * 2) - MAX_OFFSET_CHANGE)
    newX = Math.max(48, Math.min(GAME_WIDTH - newWidth - 48, newX))

    // Road edges move in whole chunky pixels for a crisp staircase look.
    newWidth = snapToPixel(newWidth)
    newX = snapToPixel(newX)

    let stripeColor =
        previousSegment.shoulderStripeColor === '#f50000ff'
            ? '#f1f1f1ff'
            : '#f50000ff'

    shouldDrawDash = !shouldDrawDash

    return {
        y: previousSegment.y - road.segmentHeight,
        width: newWidth,
        x: newX,
        shoulderStripeColor: stripeColor,
        isDashed: shouldDrawDash,
    }
}

function getSegmentAt(y) {
    return (
        roadSegments.find(
            (segment) => y >= segment.y && y < segment.y + road.segmentHeight
        ) || roadSegments[roadSegments.length - 1]
    )
}

// Objects are placed on the two newest segments, whose shape is already known.
// Their x range has to fit both, because the road shifts from one to the next.
function getTopTwoSegments() {
    return roadSegments.slice(-2)
}

function generateObstacle() {
    const obstacleWidth =
        Math.random() < OBSTACLE_LARGE_CHANCE
            ? OBSTACLE_LARGE_SIZE
            : OBSTACLE_SMALL_SIZE
    const obstacleHeight = obstacleWidth

    const [lowerSegment, upperSegment] = getTopTwoSegments()
    const roadLeft = Math.max(lowerSegment.x, upperSegment.x)
    const roadRight = Math.min(
        lowerSegment.x + lowerSegment.width,
        upperSegment.x + upperSegment.width
    )

    const obstacleX =
        roadLeft + Math.random() * (roadRight - roadLeft - obstacleWidth)
    // Bottom-aligned with the lower segment, so even a 48px banana only
    // reaches into the upper one.
    const obstacleY = lowerSegment.y + road.segmentHeight - obstacleHeight

    return {
        x: obstacleX,
        y: obstacleY,
        width: obstacleWidth,
        height: obstacleHeight,
    }
}

function generateTree() {
    const [lowerSegment, upperSegment] = getTopTwoSegments()

    const padding = 16
    const roadToTreeBuffer = 24

    const leftMinX = padding
    const leftMaxX =
        Math.min(lowerSegment.x, upperSegment.x) - TREE_WIDTH - roadToTreeBuffer
    const rightMinX =
        Math.max(
            lowerSegment.x + lowerSegment.width,
            upperSegment.x + upperSegment.width
        ) + roadToTreeBuffer
    const rightMaxX = GAME_WIDTH - TREE_WIDTH - padding

    const sides = []
    if (leftMaxX >= leftMinX) {
        sides.push({ name: 'left', minX: leftMinX, maxX: leftMaxX })
    }
    if (rightMaxX >= rightMinX) {
        sides.push({ name: 'right', minX: rightMinX, maxX: rightMaxX })
    }
    if (sides.length === 0) {
        return null
    }

    const side = sides[Math.floor(Math.random() * sides.length)]

    return {
        x: Math.random() * (side.maxX - side.minX) + side.minX,
        // The 64px tree covers exactly the two segments it was checked against.
        y: upperSegment.y,
        width: TREE_WIDTH,
        height: TREE_HEIGHT,
        side: side.name,
    }
}

function startRain() {
    if (!isRaining) {
        isRaining = true
        isTransitioningRain = true
        rainTargetCount = RAIN_COUNT
        player.speed = PLAYER_RAIN_SPEED

        if (!safetyCar) {
            safetyCar = createSafetyCar()
        } else {
            safetyCar.state = 'entering'
            safetyCar.entryStartY = safetyCar.y
            safetyCar.entryProgress = 0
        }
    }
}

function stopRain() {
    if (isRaining) {
        isRaining = false
        isTransitioningRain = true
        rainTargetCount = 0
        player.speed = INITIAL_PLAYER_STATE.speed

        if (safetyCar) {
            safetyCar.state = 'exiting'
        }
    }
}
function scheduleNextRainToggle() {
    rainToggleTimer = (Math.random() * 24 + 8) * 1000
}

function updateRainToggle(dt) {
    rainToggleTimer -= dt * FRAME_DURATION
    if (rainToggleTimer > 0) {
        return
    }

    if (isRaining) {
        stopRain()
    } else {
        startRain()
    }
    scheduleNextRainToggle()
}

function updateSafetyCar(dt) {
    if (!safetyCar) {
        return
    }

    // Follow the road the car is actually driving on: the segments under it
    // plus a short look ahead. Aiming at a point far ahead made it cut corners.
    const lookAheadTop = safetyCar.y - SAFETY_CAR_LOOK_AHEAD
    const segmentsAround = roadSegments.filter(
        (segment) =>
            segment.y + road.segmentHeight > lookAheadTop &&
            segment.y < safetyCar.y + safetyCar.height
    )
    const segmentsUnderCar = segmentsAround.filter(
        (segment) => segment.y + road.segmentHeight > safetyCar.y
    )

    const roadCenter =
        segmentsAround.reduce(
            (sum, segment) => sum + segment.x + segment.width / 2,
            0
        ) / segmentsAround.length

    safetyCar.swayTime += dt
    const swayOffset = Math.sin(safetyCar.swayTime * SAFETY_CAR_SWAY_SPEED) * 24

    const targetX = roadCenter - safetyCar.width / 2 + swayOffset

    safetyCar.x += (targetX - safetyCar.x) * (1 - Math.pow(0.9, dt))

    // Keep the car on the narrowest part of the road directly underneath it.
    const padding = 16
    const minX =
        Math.max(...segmentsUnderCar.map((segment) => segment.x)) + padding
    const maxX =
        Math.min(
            ...segmentsUnderCar.map((segment) => segment.x + segment.width)
        ) -
        safetyCar.width -
        padding

    safetyCar.x = Math.max(minX, Math.min(maxX, safetyCar.x))

    const EXIT_SPEED = 4

    if (safetyCar.state === 'entering') {
        // Ease-out cubic: drops in quickly from the top edge and glides into
        // its position with the speed reaching exactly zero at the end.
        safetyCar.entryProgress = Math.min(
            safetyCar.entryProgress + dt / SAFETY_CAR_ENTRY_DURATION,
            1
        )
        const easedProgress = 1 - Math.pow(1 - safetyCar.entryProgress, 3)
        safetyCar.y =
            safetyCar.entryStartY +
            (safetyCar.targetY - safetyCar.entryStartY) * easedProgress

        if (safetyCar.entryProgress >= 1) {
            safetyCar.state = 'active'
            safetyCar.bobTime = 0
        }
    } else if (safetyCar.state === 'active') {
        // Slight vertical drift so the car does not look glued to its spot.
        // (1 - cos) starts with zero speed, so it blends in without a jerk.
        safetyCar.bobTime += dt
        safetyCar.y =
            safetyCar.targetY +
            ((1 - Math.cos(safetyCar.bobTime * SAFETY_CAR_BOB_SPEED)) / 2) *
                SAFETY_CAR_BOB_DISTANCE
    } else if (safetyCar.state === 'exiting') {
        safetyCar.y -= EXIT_SPEED * dt
        if (safetyCar.y + safetyCar.height < 0) {
            safetyCar.y = -safetyCar.height
            safetyCar.state = null
            safetyCar = null
        }
    }
}

function checkOffRoad() {
    let currentPlayerRoadSegment = null
    for (const segment of roadSegments) {
        if (
            player.y + player.height > segment.y &&
            player.y < segment.y + road.segmentHeight
        ) {
            currentPlayerRoadSegment = segment
            break
        }
    }

    if (currentPlayerRoadSegment) {
        const playerLeft = player.x
        const playerRight = player.x + player.width
        const roadLeft = currentPlayerRoadSegment.x
        const roadRight =
            currentPlayerRoadSegment.x + currentPlayerRoadSegment.width

        if (playerLeft < roadLeft - 8 || playerRight > roadRight + 8) {
            isGameOver = true
            checkNewHighScore()
        }
    }
}

function updateRain(dt) {
    if (isTransitioningRain) {
        if (isRaining && currentRainCount < rainTargetCount) {
            const dropsToAdd = Math.ceil(
                (rainTargetCount - currentRainCount) / 10
            )
            for (let i = 0; i < dropsToAdd; i++) {
                rainDrops.push(generateRaindrop())
            }
            currentRainCount = rainDrops.length
            if (currentRainCount >= rainTargetCount) {
                isTransitioningRain = false
            }
        } else if (!isRaining && currentRainCount > rainTargetCount) {
            currentRainCount = rainDrops.length
            if (currentRainCount <= rainTargetCount) {
                isTransitioningRain = false
                rainDrops = []
            }
        } else if (
            (isRaining && currentRainCount === rainTargetCount) ||
            (!isRaining && currentRainCount === rainTargetCount)
        ) {
            isTransitioningRain = false
        }
    }

    for (let i = 0; i < rainDrops.length; i++) {
        const drop = rainDrops[i]

        drop.x += RAIN_DIRECTION_X * drop.speed * dt
        drop.y += (RAIN_DIRECTION_Y * drop.speed + road.speed * 0.5) * dt

        if (drop.y > GAME_HEIGHT || drop.x > GAME_WIDTH + drop.length) {
            if (
                isRaining ||
                (isTransitioningRain && currentRainCount < rainTargetCount)
            ) {
                const spawnXRange = GAME_WIDTH + GAME_WIDTH * 0.5
                drop.x = Math.random() * spawnXRange - GAME_WIDTH * 0.1

                drop.y = Math.random() * GAME_HEIGHT * 0.2 - GAME_HEIGHT * 0.4

                drop.speed =
                    Math.random() * (RAIN_SPEED_MAX - RAIN_SPEED_MIN) +
                    RAIN_SPEED_MIN
                drop.length =
                    Math.random() * (RAIN_LENGTH_MAX - RAIN_LENGTH_MIN) +
                    RAIN_LENGTH_MIN
            } else {
                rainDrops.splice(i, 1)
                i--
            }
        }
    }
    currentRainCount = rainDrops.length
}

function updateSmoke(dt) {
    for (let i = 0; i < smokeParticles.length; i++) {
        const particle = smokeParticles[i]

        particle.x += particle.speedX * dt
        particle.y += (particle.speedY + road.speed) * dt

        particle.alpha = Math.max(0, particle.alpha - SMOKE_FADE_SPEED * dt)
        particle.size += SMOKE_GROW_SPEED * dt

        if (
            particle.alpha <= 0 ||
            particle.x + particle.size < 0 ||
            particle.x > GAME_WIDTH ||
            particle.y + particle.size < 0 ||
            particle.y > GAME_HEIGHT
        ) {
            smokeParticles.splice(i, 1)
            i--
        }
    }
}

// dt is the elapsed time in 60 fps frames (1 = 16.7 ms), so all speeds
// keep their original per-frame meaning independent of the refresh rate.
function update(dt) {
    if (isGameOver) {
        return
    }

    updateRainToggle(dt)

    if (isRaining) {
        rainFilterOpacity = Math.min(
            rainFilterOpacity + RAIN_FILTER_FADE_SPEED * dt,
            RAIN_FILTER_MAX_OPACITY
        )
    } else {
        if (currentRainCount === 0) {
            rainFilterOpacity = Math.max(
                rainFilterOpacity - RAIN_FILTER_FADE_SPEED * dt,
                0
            )
        }
    }

    if (pressedKeys['ArrowLeft']) {
        player.x -= player.speed * dt
    }
    if (pressedKeys['ArrowRight']) {
        player.x += player.speed * dt
    }

    if (player.x < 0) {
        player.x = 0
    }
    if (player.x + player.width > GAME_WIDTH) {
        player.x = GAME_WIDTH - player.width
    }

    const roadDistance = road.speed * dt

    for (let i = 0; i < roadSegments.length; i++) {
        roadSegments[i].y += roadDistance
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].y += roadDistance
    }
    for (let i = 0; i < trees.length; i++) {
        trees[i].y += roadDistance
    }

    for (let i = 0; i < ripples.length; i++) {
        ripples[i].y += roadDistance
    }

    while (roadSegments[0].y > GAME_HEIGHT) {
        roadSegments.shift()
    }

    while (roadSegments[roadSegments.length - 1].y >= -ROAD_LOOKAHEAD) {
        const newSegment = generateRoadSegment(
            roadSegments[roadSegments.length - 1]
        )
        roadSegments.push(newSegment)

        score++

        segmentsSinceLastObstacle++
        if (segmentsSinceLastObstacle >= obstacle_spawn_interval) {
            obstacles.push(generateObstacle())
            segmentsSinceLastObstacle = 0
        }

        segmentsSinceLastEnemy++
        if (segmentsSinceLastEnemy >= enemy_spawn_interval) {
            enemies.push(generateEnemyCar())
            segmentsSinceLastEnemy = 0
        }

        segmentsSinceLastTree++
        if (segmentsSinceLastTree >= TREE_SPAWN_INTERVAL) {
            const tree = generateTree()
            if (tree) {
                trees.push(tree)
            }
            segmentsSinceLastTree = 0
        }

        segmentsSinceLastRipple++
        if (segmentsSinceLastRipple >= RIPPLE_SPAWN_INTERVAL) {
            const numRipplesToSpawn = Math.floor(Math.random() * 7) + 1
            for (let i = 0; i < numRipplesToSpawn; i++) {
                ripples.push(generateRipple(newSegment))
            }
            segmentsSinceLastRipple = 0
        }
    }

    if (score > 0 && score % 100 === 0 && !speedIncreasedForThisMilestone) {
        road.speed = Math.min(road.speed + 0.5, MAX_ROAD_SPEED)
        if (obstacle_spawn_interval > MIN_OBSTACLE_SPAWN_INTERVAL) {
            obstacle_spawn_interval -= 4
        }
        if (enemy_spawn_interval > MIN_ENEMY_SPAWN_INTERVAL) {
            enemy_spawn_interval -= 2
        }
        speedIncreasedForThisMilestone = true
    } else if (score % 100 !== 0) {
        speedIncreasedForThisMilestone = false
    }

    for (let i = 0; i < obstacles.length; i++) {
        if (checkCollision(player, obstacles[i])) {
            isGameOver = true
            checkNewHighScore()
        }
    }

    for (let enemy of enemies) {
        if (enemy.isCrashing) {
            enemy.speedY = Math.min(
                enemy.speedY * Math.pow(1.05, dt),
                road.speed
            )
        }

        enemy.y += enemy.speedY * dt
        enemy.time += dt

        const dx = player.x + player.width / 2 - (enemy.x + enemy.width / 2)
        const dy = player.y + player.height / 2 - (enemy.y + enemy.height / 2)
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (!enemy.isCrashing) {
            if (distance < PLAYER_DETECTION_RADIUS) {
                enemy.waveAmplitude = enemy.originalWaveAmplitude * 1.4
                enemy.waveFrequency = enemy.originalWaveFrequency * 1.2
            } else {
                enemy.waveAmplitude = enemy.originalWaveAmplitude
                enemy.waveFrequency = enemy.originalWaveFrequency
            }
        }

        const offset =
            Math.sin(enemy.time * enemy.waveFrequency) * enemy.waveAmplitude
        enemy.x += (enemy.targetX + offset - enemy.x) * (1 - Math.pow(0.9, dt))

        const segment = roadSegments.find(
            (seg) =>
                enemy.y + enemy.height > seg.y &&
                enemy.y < seg.y + road.segmentHeight
        )

        if (segment) {
            const roadLeft = segment.x
            const roadRight = segment.x + segment.width
            const padding = 32

            if (!enemy.isCrashing) {
                if (enemy.x < roadLeft + padding) {
                    enemy.targetX = roadLeft + padding
                    enemy.baseX = roadLeft + padding
                    enemy.waveAmplitude *= Math.pow(0.95, dt)
                    enemy.y -= 0.5 * dt
                } else if (enemy.x + enemy.width > roadRight - padding) {
                    enemy.targetX = roadRight - enemy.width - padding
                    enemy.baseX = roadRight - enemy.width - padding
                    enemy.waveAmplitude *= Math.pow(0.95, dt)
                    enemy.y -= 0.5 * dt
                } else {
                    enemy.targetX = enemy.baseX
                }
            }
        }

        for (let i = 0; i < obstacles.length; i++) {
            if (checkCollision(enemy, obstacles[i])) {
                enemyCollision(enemy, obstacles[i])
            }
        }
        if (safetyCar && checkCollision(enemy, safetyCar)) {
            enemyCollision(enemy, safetyCar)
        }

        if (enemy.isCrashing && enemy.isSmoking) {
            enemy.smokeAccumulator += SMOKE_PARTICLES_PER_FRAME * dt
            while (enemy.smokeAccumulator >= 1) {
                enemy.smokeAccumulator--
                if (smokeParticles.length < MAX_SMOKE_PARTICLES) {
                    smokeParticles.push(
                        generateSmokeParticle(
                            enemy.x + enemy.width / 2,
                            enemy.y + enemy.height
                        )
                    )
                }
            }
        }
    }

    for (let i = 0; i < enemies.length; i++) {
        if (checkCollision(player, enemies[i])) {
            isGameOver = true
            checkNewHighScore()
        }

        for (let j = i + 1; j < enemies.length; j++) {
            const enemy1 = enemies[i]
            const enemy2 = enemies[j]

            if (checkCollision(enemy1, enemy2)) {
                enemyCollision(enemy1, enemy2)
                enemyCollision(enemy2, enemy1)
            }
        }
    }

    if (safetyCar) {
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (checkCollision(safetyCar, obstacles[i])) {
                obstacles.splice(i, 1)
            }
        }
    }

    // Enemies can drift upwards while braking at the road edge, so they are
    // also removed once they are far above the screen.
    enemies = enemies.filter(
        (enemy) => enemy.y < GAME_HEIGHT && enemy.y > -ENEMY_HEIGHT * 6
    )
    trees = trees.filter((tree) => tree.y < GAME_HEIGHT)
    ripples = ripples.filter((ripple) => ripple.y < GAME_HEIGHT)
    obstacles = obstacles.filter((obstacle) => obstacle.y < GAME_HEIGHT)

    updateRain(dt)
    checkOffRoad()
    updateSmoke(dt)
    updateSafetyCar(dt)
}

function drawSafetyCar() {
    if (!safetyCar) {
        return
    }

    const roundedY = Math.round(safetyCar.y)
    const x = Math.round(safetyCar.x)

    drawCenteredSprite(
        CAR_SHADOW_SPRITE,
        x + safetyCar.width / 2,
        roundedY + safetyCar.height - 8
    )
    drawExhaustFlame({ ...safetyCar, x: x }, roundedY)

    ctx.drawImage(
        safetyCarImage,
        x,
        roundedY,
        safetyCar.width,
        safetyCar.height
    )
}

function drawScanlines() {
    ctx.drawImage(SCANLINES_SPRITE, 0, 0)
}

function draw() {
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    drawSegments()
    drawRipples()
    drawTrees()
    drawObstacles()
    drawSafetyCar()
    drawEnemies()
    drawPlayer()
    drawSmokeParticles()
    drawRain()
    drawRainFilter()

    if (isGameOver) {
        drawGameOver()
    } else if (!gameStarted) {
        drawStartScreen()
    } else {
        drawScores()
    }

    drawScanlines()
}

function gameLoop() {
    // Start and game over screens keep looping too, so their texts can blink.
    if (gameStarted && !isGameOver) {
        const now = performance.now()
        // Clamp so a long pause (e.g. a background tab) does not teleport everything.
        const dt = Math.min((now - lastFrameTime) / FRAME_DURATION, MAX_DELTA)
        lastFrameTime = now

        update(dt)
    }

    draw()
    animationFrameId = requestAnimationFrame(gameLoop)
}
