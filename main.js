const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

const GAME_WIDTH = 800
const GAME_HEIGHT = 600

canvas.width = GAME_WIDTH
canvas.height = GAME_HEIGHT

const playerImage = new Image()
playerImage.src = './player.png'

const obstacleImage = new Image()
obstacleImage.src = './banana.png'

const treeImage = new Image()
treeImage.src = './tree.png'

const enemyImage = new Image()
enemyImage.src = './enemy.png'

let imagesLoaded = 0
const totalImages = 4

function onImageLoad() {
    imagesLoaded++
    if (imagesLoaded === totalImages) {
        resetGame()
    }
}

playerImage.onload = onImageLoad
obstacleImage.onload = onImageLoad
treeImage.onload = onImageLoad
enemyImage.onload = onImageLoad

const INITIAL_PLAYER_STATE = {
    width: 48,
    height: 64,
    x: GAME_WIDTH / 2 - 24,
    y: GAME_HEIGHT - 64 - 16,
    speed: 2,
}

const INITIAL_ROAD_STATE = {
    width: 320,
    segmentHeight: 32,
    speed: 2,
    color: '#888',
    shoulderColor: '#437a55ff',
}

const MAX_ROAD_SPEED = 5

let player = { ...INITIAL_PLAYER_STATE }
let road = { ...INITIAL_ROAD_STATE }

let ghostTrail = []
const GHOST_LENGTH = 8

const MIN_WIDTH_CHANGE = -16
const MAX_WIDTH_CHANGE = 16
const MAX_OFFSET_CHANGE = 24

const pressedKeys = {}

let initialSegmentsCount
let roadSegments = []
const MAX_ROAD_WIDTH = 448
const MIN_ROAD_WIDTH = 288
let shouldDrawDash = true

let obstacles = []
const OBSTACLE_MIN_WIDTH = 32
const OBSTACLE_MAX_WIDTH = 48
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
const RIPPLE_MIN_RADIUS = 2
const RIPPLE_MAX_RADIUS = 8

const RIPPLE_SHOULDER_PADDING = 8
const RIPPLE_ROAD_BUFFER = 8

const SHOULDER_RIPPLE_COLORS = [
    { r: 70, g: 120, b: 80 },
    { r: 100, g: 150, b: 110 },
    { r: 90, g: 70, b: 50 },
    { r: 120, g: 90, b: 60 },
]

let score = 0
let highScore = parseInt(localStorage.getItem('highScore')) || 0
let newHighScoreAchieved = false
let isGameOver = false
let gameStarted = false
let speedIncreasedForThisMilestone = false

const RAIN_COLOR = 'rgba(156, 214, 233, 0.6)'
const RAIN_COUNT = 192
const RAIN_SPEED_MIN = 8
const RAIN_SPEED_MAX = 16
const RAIN_LENGTH_MIN = 16
const RAIN_LENGTH_MAX = 32
const RAIN_ANGLE = Math.PI / 16

let rainDrops = []
let isRaining = true
let rainToggleInterval = null
let isTransitioningRain = false
let rainTargetCount = RAIN_COUNT
let currentRainCount = 0
let rainFilterOpacity = 0
const RAIN_FILTER_FADE_SPEED = 0.005
const RAIN_FILTER_MAX_OPACITY = 0.4

let smokeParticles = []
const SMOKE_COLOR = 'rgba(100, 100, 100, 0.4)'
const SMOKE_FADE_SPEED = 0.008
const SMOKE_GROW_SPEED = 0.4
const SMOKE_MIN_SIZE = 4
const SMOKE_MAX_SIZE = 12

function resetGame() {
    player = { ...INITIAL_PLAYER_STATE }
    road = { ...INITIAL_ROAD_STATE }

    roadSegments = []
    initialSegmentsCount = Math.ceil(GAME_HEIGHT / road.segmentHeight)
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
    ghostTrail = []
    shouldDrawDash = true
    ripples = []
    segmentsSinceLastRipple = 0
    enemies = []
    enemy_spawn_interval = INITIAL_ENEMY_SPAWN_INTERVAL
    segmentsSinceLastEnemy = 0
    rainDrops = []
    isRaining = true
    isTransitioningRain = false
    currentRainCount = 0
    rainTargetCount = RAIN_COUNT
    rainFilterOpacity = 0
    clearTimeout(rainToggleInterval)
    rainToggleInterval = null
    toggleRainRandomly()
    smokeParticles = []

    gameLoop()
}

document.addEventListener('keydown', (e) => {
    pressedKeys[e.key] = true
    if (isGameOver && (e.key === 'r' || e.key === 'R')) {
        resetGame()
    }
    if (!gameStarted && e.key === ' ') {
        gameStarted = true
        gameLoop()
    }
})

document.addEventListener('keyup', (e) => {
    pressedKeys[e.key] = false
})

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width - COLLISION_TOLERANCE &&
        rect1.x + rect1.width + COLLISION_TOLERANCE > rect2.x &&
        rect1.y < rect2.y + rect2.height - COLLISION_TOLERANCE &&
        rect1.y + rect1.height + COLLISION_TOLERANCE > rect2.y
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
    const initialRoadWidth = INITIAL_ROAD_STATE.width
    const initialRoadX = (GAME_WIDTH - initialRoadWidth) / 2

    for (let i = 0; i < initialSegmentsCount; i++) {
        segments.push({
            y: i * road.segmentHeight,
            width: initialRoadWidth,
            x: initialRoadX,
            shoulderStripeColor: i % 2 === 0 ? '#f50000ff' : '#f1f1f1ff',
            isDashed: shouldDrawDash,
        })
        shouldDrawDash = !shouldDrawDash
    }
    return segments
}

function drawEnemies() {
    for (const enemy of enemies) {
        const roundedY = Math.round(enemy.y)
        const alpha = 0.4 + 0.35 * Math.sin(performance.now() / 120)

        ctx.save()
        ctx.filter = 'blur(4px)'
        ctx.fillStyle = `rgba(255, 85, 0, ${alpha.toFixed(2)})`
        ctx.beginPath()
        ctx.ellipse(
            enemy.x + enemy.width / 2,
            roundedY + enemy.height - 12,
            enemy.width / 3.2,
            24,
            0,
            0,
            Math.PI * 2
        )
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.filter = 'blur(4px)'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.beginPath()
        ctx.ellipse(
            enemy.x + enemy.width / 2,
            roundedY + enemy.height - 8,
            enemy.width / 2.4,
            16,
            0,
            0,
            Math.PI * 2
        )
        ctx.fill()
        ctx.restore()

        ctx.save()
        ctx.translate(enemy.x + enemy.width / 2, roundedY + enemy.height / 2)
        ctx.rotate(enemy.rotation)
        ctx.drawImage(
            enemyImage,
            -enemy.width / 2,
            -enemy.height / 2,
            enemy.width,
            enemy.height
        )

        ctx.restore()
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = '#f1f1f1ff'
    ctx.textAlign = 'center'

    if (newHighScoreAchieved) {
        ctx.font = '24px Arial'
        ctx.fillText('NEW HIGHSCORE!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 128)
    } else {
        ctx.font = '28px Arial'
        ctx.fillText(
            'Highscore: ' + highScore,
            GAME_WIDTH / 2,
            GAME_HEIGHT / 2 + 128
        )
    }

    ctx.font = 'bold 48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('GAME OVER!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 32)

    ctx.font = '32px Arial'
    ctx.fillText('Final Score: ' + score, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20)
    ctx.fillText('Press R to Restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 64)
}

function drawObstacles() {
    for (const obstacle of obstacles) {
        const roundedY = Math.round(obstacle.y)
        ctx.save()
        ctx.filter = 'blur(4px)'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.beginPath()
        ctx.ellipse(
            obstacle.x + obstacle.width / 2,
            roundedY + obstacle.height - 8,
            obstacle.width / 2.4,
            16,
            0,
            0,
            Math.PI * 2
        )
        ctx.fill()
        ctx.restore()

        ctx.drawImage(
            obstacleImage,
            obstacle.x,
            roundedY,
            obstacle.width,
            obstacle.height
        )
    }
}

function drawPlayer() {
    const roundedPlayerY = Math.round(player.y)
    const alpha = 0.4 + 0.35 * Math.sin(performance.now() / 120)

    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = `rgba(255, 85, 0, ${alpha.toFixed(2)})`
    ctx.beginPath()
    ctx.ellipse(
        player.x + player.width / 2,
        roundedPlayerY + player.height - 16,
        player.width / 3.2,
        24,
        0,
        0,
        Math.PI * 2
    )
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = 'rgba(255, 115, 0, 0.2)'
    ctx.beginPath()
    ctx.ellipse(
        player.x + player.width / 2,
        roundedPlayerY + player.height,
        player.width / 3.6,
        32,
        0,
        0,
        Math.PI * 2
    )
    ctx.fill()
    ctx.restore()

    for (let i = 0; i < ghostTrail.length; i++) {
        const ghost = ghostTrail[i]
        const alpha = ((i + 1) / (ghostTrail.length + 1)) * 0.7

        const roundedGhostY = Math.round(ghost.y)
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.filter = 'blur(2px) saturate(60%)'
        ctx.drawImage(
            playerImage,
            ghost.x,
            roundedGhostY,
            player.width,
            player.height
        )
        ctx.restore()
    }

    ctx.drawImage(
        playerImage,
        player.x,
        roundedPlayerY,
        player.width,
        player.height
    )
}

function drawRain() {
    if (rainDrops.length === 0 && !isTransitioningRain) return

    ctx.strokeStyle = RAIN_COLOR
    ctx.lineWidth = Math.ceil(Math.random() * 3) + 1

    for (const drop of rainDrops) {
        ctx.beginPath()
        ctx.moveTo(drop.x, drop.y)
        ctx.lineTo(
            drop.x - Math.sin(RAIN_ANGLE) * drop.length,
            drop.y - Math.cos(RAIN_ANGLE) * drop.length
        )
        ctx.stroke()
    }
}

function drawRainFilter() {
    if (rainFilterOpacity > 0) {
        ctx.save()
        ctx.fillStyle = `rgba(0, 0, 50, ${rainFilterOpacity})`
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
        ctx.restore()
    }
}

function drawRipples() {
    for (const ripple of ripples) {
        const roundedY = Math.round(ripple.y)
        ctx.save()

        ctx.fillStyle = ripple.color
        ctx.beginPath()
        ctx.arc(
            ripple.x + ripple.radius,
            roundedY + ripple.radius,
            ripple.radius,
            0,
            Math.PI * 2
        )
        ctx.fill()
        ctx.restore()
    }
}

function drawScores() {
    const scoreText = 'Score: ' + score
    ctx.font = '24px Arial'
    const textWidth = ctx.measureText(scoreText).width
    const padding = 8
    const backgroundX = GAME_WIDTH - textWidth - padding * 3
    const backgroundY = padding / 2

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(
        backgroundX,
        backgroundY,
        textWidth + padding * 2,
        24 + padding * 2
    )
    ctx.fillStyle = '#f1f1f1ff'
    ctx.textAlign = 'right'
    ctx.fillText(scoreText, GAME_WIDTH - 16, 32)

    const highScoreText =
        score >= highScore ? 'New Highscore!' : 'Highscore: ' + highScore
    ctx.font = '24px Arial'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(
        8,
        backgroundY,
        ctx.measureText(highScoreText).width + padding * 2,
        24 + padding * 2
    )
    ctx.fillStyle = '#f1f1f1ff'
    ctx.fillText(highScoreText, 16, 32)
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

        if (segment.isDashed) {
            ctx.strokeStyle = '#f1f1f1ff'
            ctx.lineWidth = 8
            ctx.setLineDash([24, 32])
            ctx.beginPath()
            ctx.moveTo(segment.x + segment.width / 2, segment.y)
            ctx.lineTo(
                segment.x + segment.width / 2,
                segment.y + road.segmentHeight
            )
            ctx.stroke()
            ctx.setLineDash([])
        }
    }
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    ctx.fillStyle = '#f1f1f1ff'
    ctx.textAlign = 'center'

    ctx.font = 'bold 48px Arial'
    ctx.fillText('Arcade Racing', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60)

    ctx.font = '32px Arial'
    ctx.fillText('Press SPACE to Start', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20)

    ctx.font = '24px Arial'
    ctx.fillText('Use Arrow Keys to Move', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 70)

    const highScoreText = 'Current Highscore: ' + highScore
    ctx.font = 'bold 28px Arial'
    ctx.fillText(highScoreText, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 140)
}

function drawSmokeParticles() {
    for (const particle of smokeParticles) {
        ctx.save()
        ctx.globalAlpha = particle.alpha
        ctx.fillStyle = SMOKE_COLOR
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }
}

function drawTrees() {
    for (const tree of trees) {
        const roundedY = Math.round(tree.y)
        ctx.save()
        ctx.filter = 'blur(4px)'
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'

        ctx.beginPath()
        ctx.ellipse(
            tree.x + tree.width / 2,
            roundedY + tree.height - 8,
            tree.width / 1.8,
            16,
            0,
            0,
            Math.PI * 2
        )
        ctx.fill()
        ctx.restore()

        ctx.drawImage(treeImage, tree.x, roundedY, tree.width, tree.height)
    }
}

function enemyCollision(enemy, obj) {
    if (!enemy.isCrashing) {
        enemy.isCrashing = true
        enemy.waveAmplitude = 0
        enemy.waveFrequency = 0
        enemy.targetX = enemy.x
        enemy.baseX = enemy.x
        if (enemy.x + enemy.width / 2 < obj.x + obj.width / 2) {
            enemy.rotationDirection = -1
        } else {
            enemy.rotationDirection = 1
        }
        enemy.isSmoking = true
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

function getRandomGreyColor(alpha) {
    const grey = Math.floor(Math.random() * 100) + 20
    return `rgba(${grey}, ${grey}, ${grey}, ${alpha.toFixed(2)})`
}

function getRandomShoulderColor(alpha) {
    const randomColor =
        SHOULDER_RIPPLE_COLORS[
            Math.floor(Math.random() * SHOULDER_RIPPLE_COLORS.length)
        ]
    const r = Math.min(
        255,
        Math.max(0, randomColor.r + Math.floor(Math.random() * 40) - 20)
    )
    const g = Math.min(
        255,
        Math.max(0, randomColor.g + Math.floor(Math.random() * 40) - 20)
    )
    const b = Math.min(
        255,
        Math.max(0, randomColor.b + Math.floor(Math.random() * 40) - 20)
    )
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}

function generateEnemyCar(roadSegment) {
    const safeMargin = 16
    const availableWidth = roadSegment.width - ENEMY_WIDTH - safeMargin * 2
    const random = Math.random()
    const baseX = roadSegment.x + safeMargin + random * availableWidth

    return {
        baseX: baseX,
        x: baseX,
        y: -ENEMY_HEIGHT - random * 192,
        width: ENEMY_WIDTH,
        height: ENEMY_HEIGHT,
        isCrashing: false,
        rotation: 0,
        rotationDirection: 0,
        speedY: road.speed - 0.75 - random + 0.125 * isRaining,
        targetX: baseX,
        time: random * 1000,
        waveAmplitude: random * 16 + 8 + 4 * isRaining,
        waveFrequency: random * 0.03 + 0.02 + 0.005 * isRaining,
        originalWaveAmplitude: random * 16 + 8 + 4 * isRaining,
        originalWaveFrequency: random * 0.03 + 0.02 + 0.005 * isRaining,
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

function generateRipple(roadSegment) {
    const rippleRadius =
        Math.random() * (RIPPLE_MAX_RADIUS - RIPPLE_MIN_RADIUS) +
        RIPPLE_MIN_RADIUS
    const rippleWidth = rippleRadius * 2
    const rippleHeight = rippleRadius * 2

    let rippleX
    let rippleColor
    const alpha = Math.random() * 0.3 + 0.1
    const minSpawnX = 0 + RIPPLE_SHOULDER_PADDING
    const maxSpawnX = GAME_WIDTH - RIPPLE_SHOULDER_PADDING - rippleWidth

    rippleX = Math.random() * (maxSpawnX - minSpawnX) + minSpawnX

    const roadLeftEdge = roadSegment.x
    const roadRightEdge = roadSegment.x + roadSegment.width

    if (
        rippleX + rippleWidth > roadLeftEdge + RIPPLE_ROAD_BUFFER &&
        rippleX < roadRightEdge - RIPPLE_ROAD_BUFFER
    ) {
        rippleColor = getRandomGreyColor(alpha)
    } else {
        rippleColor = getRandomShoulderColor(alpha)
    }

    const rippleY = -rippleHeight - Math.random() * GAME_HEIGHT * 0.1

    return {
        x: rippleX,
        y: rippleY,
        width: rippleWidth,
        height: rippleHeight,
        radius: rippleRadius,
        color: rippleColor,
    }
}

function generateRoadSegment(previousSegment) {
    if (initialSegmentsCount > 0) {
        initialSegmentsCount--
        const initialRoadWidth = INITIAL_ROAD_STATE.width
        const initialRoadX = (GAME_WIDTH - initialRoadWidth) / 2

        shouldDrawDash = !shouldDrawDash

        return {
            y: previousSegment.y - road.segmentHeight,
            width: initialRoadWidth,
            x: initialRoadX,
            shoulderStripeColor:
                previousSegment.shoulderStripeColor === '#f50000ff'
                    ? '#f1f1f1ff'
                    : '#f50000ff',
            isDashed: shouldDrawDash,
        }
    } else {
        let newWidth =
            previousSegment.width +
            (Math.random() * (MAX_WIDTH_CHANGE - MIN_WIDTH_CHANGE) +
                MIN_WIDTH_CHANGE)
        newWidth = Math.max(Math.min(MAX_ROAD_WIDTH, newWidth), MIN_ROAD_WIDTH)

        let newX =
            previousSegment.x +
            (Math.random() * (MAX_OFFSET_CHANGE * 2) - MAX_OFFSET_CHANGE)
        newX = Math.max(48, Math.min(GAME_WIDTH - newWidth - 48, newX))

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
}

function generateObstacle(roadSegment) {
    const obstacleWidth =
        Math.random() * (OBSTACLE_MAX_WIDTH - OBSTACLE_MIN_WIDTH) +
        OBSTACLE_MIN_WIDTH
    const obstacleHeight = obstacleWidth

    const obstacleX =
        roadSegment.x + Math.random() * (roadSegment.width - obstacleWidth)
    const obstacleY = -obstacleHeight - Math.random() * GAME_HEIGHT * 0.5

    return {
        x: obstacleX,
        y: obstacleY,
        width: obstacleWidth,
        height: obstacleHeight,
    }
}

function generateTree() {
    const side = Math.random() < 0.5 ? 'left' : 'right'
    let treeX
    const topSegment = roadSegments[roadSegments.length - 1]

    const padding = 16
    const roadToTreeBuffer = 24

    if (side === 'left') {
        const minX = padding
        const maxX = topSegment.x - TREE_WIDTH - roadToTreeBuffer
        if (maxX <= minX) {
            treeX = minX
        } else {
            treeX = Math.random() * (maxX - minX) + minX
        }
    } else {
        const minX = topSegment.x + topSegment.width + roadToTreeBuffer
        const maxX = GAME_WIDTH - TREE_WIDTH - padding
        if (maxX <= minX) {
            treeX = minX
        } else {
            treeX = Math.random() * (maxX - minX) + minX
        }
    }

    const treeY = topSegment.y - TREE_HEIGHT - Math.random() * GAME_HEIGHT * 0.2

    return {
        x: treeX,
        y: treeY,
        width: TREE_WIDTH,
        height: TREE_HEIGHT,
        side: side,
    }
}

function startRain() {
    if (!isRaining) {
        isRaining = true
        isTransitioningRain = true
        rainTargetCount = RAIN_COUNT
        player.speed = 3
    }
}

function stopRain() {
    if (isRaining) {
        isRaining = false
        isTransitioningRain = true
        rainTargetCount = 0
        player.speed = 2
    }
}

function toggleRainRandomly() {
    const nextToggleTime = (Math.random() * 24 + 8) * 1000

    if (isRaining) {
        stopRain()
    } else {
        startRain()
    }

    rainToggleInterval = setTimeout(toggleRainRandomly, nextToggleTime)
}

function updateGhostTrail() {
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

    ghostTrail.push({ x: player.x, y: player.y })

    if (ghostTrail.length > GHOST_LENGTH) {
        ghostTrail.shift()
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

function updateRain() {
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

        drop.x += Math.sin(RAIN_ANGLE) * drop.speed
        drop.y += Math.cos(RAIN_ANGLE) * drop.speed + road.speed * 0.5

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

function updateSmoke() {
    for (let i = 0; i < smokeParticles.length; i++) {
        const particle = smokeParticles[i]

        particle.x += particle.speedX
        particle.y += particle.speedY + road.speed

        particle.alpha = Math.max(0, particle.alpha - SMOKE_FADE_SPEED)
        particle.size += SMOKE_GROW_SPEED

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

function update() {
    if (isGameOver) {
        return
    }

    if (isRaining) {
        rainFilterOpacity = Math.min(
            rainFilterOpacity + RAIN_FILTER_FADE_SPEED,
            RAIN_FILTER_MAX_OPACITY
        )
    } else {
        if (currentRainCount === 0) {
            rainFilterOpacity = Math.max(
                rainFilterOpacity - RAIN_FILTER_FADE_SPEED,
                0
            )
        }
    }

    if (pressedKeys['ArrowLeft']) {
        player.x -= player.speed
    }
    if (pressedKeys['ArrowRight']) {
        player.x += player.speed
    }

    if (player.x < 0) {
        player.x = 0
    }
    if (player.x + player.width > GAME_WIDTH) {
        player.x = GAME_WIDTH - player.width
    }

    for (let i = 0; i < roadSegments.length; i++) {
        roadSegments[i].y += road.speed
    }

    for (let i = 0; i < obstacles.length; i++) {
        obstacles[i].y += road.speed
    }
    for (let i = 0; i < trees.length; i++) {
        trees[i].y += road.speed
    }

    for (let i = 0; i < ripples.length; i++) {
        ripples[i].y += road.speed
    }

    if (roadSegments[0].y > GAME_HEIGHT) {
        roadSegments.shift()
    }

    const lastSegment = roadSegments[roadSegments.length - 1]
    if (lastSegment && lastSegment.y >= -road.segmentHeight) {
        roadSegments.push(generateRoadSegment(lastSegment))

        if (initialSegmentsCount <= 0) {
            score++

            segmentsSinceLastObstacle++
            if (segmentsSinceLastObstacle >= obstacle_spawn_interval) {
                obstacles.push(
                    generateObstacle(roadSegments[roadSegments.length - 1])
                )
                segmentsSinceLastObstacle = 0
            }

            segmentsSinceLastEnemy++
            if (segmentsSinceLastEnemy >= INITIAL_ENEMY_SPAWN_INTERVAL) {
                enemies.push(
                    generateEnemyCar(roadSegments[roadSegments.length - 1])
                )
                segmentsSinceLastEnemy = 0
            }
        }

        segmentsSinceLastTree++
        if (segmentsSinceLastTree >= TREE_SPAWN_INTERVAL) {
            trees.push(generateTree())
            segmentsSinceLastTree = 0
        }

        segmentsSinceLastRipple++
        if (segmentsSinceLastRipple >= RIPPLE_SPAWN_INTERVAL) {
            const numRipplesToSpawn = Math.floor(Math.random() * 7) + 1
            for (let i = 0; i < numRipplesToSpawn; i++) {
                ripples.push(generateRipple(lastSegment))
            }
            segmentsSinceLastRipple = 0
        }
    }

    if (score > 0 && score % 100 === 0 && !speedIncreasedForThisMilestone) {
        if (road.speed < MAX_ROAD_SPEED) {
            road.speed = parseFloat((road.speed + 0.5).toFixed(1))
        }
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
            if (enemy.speedY < road.speed) {
                enemy.speedY *= 1.05
            } else {
                enemy.speedY = road.speed
            }

            const rotationSpeed = 0.04
            if (enemy.rotationDirection === 1) {
                enemy.rotation = Math.min(
                    enemy.rotation + rotationSpeed,
                    (4 * Math.PI) / 180
                )
            } else if (enemy.rotationDirection === -1) {
                enemy.rotation = Math.max(
                    enemy.rotation - rotationSpeed,
                    (-4 * Math.PI) / 180
                )
            }
        }

        enemy.y += enemy.speedY
        enemy.time += 1

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
        enemy.x += (enemy.targetX + offset - enemy.x) * 0.1

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
                    enemy.waveAmplitude *= 0.95
                    enemy.y -= 0.5
                } else if (enemy.x + enemy.width > roadRight - padding) {
                    enemy.targetX = roadRight - enemy.width - padding
                    enemy.baseX = roadRight - enemy.width - padding
                    enemy.waveAmplitude *= 0.95
                    enemy.y -= 0.5
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

        if (enemy.isCrashing && enemy.isSmoking) {
            for (let i = 0; i < 2; i++) {
                smokeParticles.push(
                    generateSmokeParticle(
                        enemy.x + enemy.width / 2,
                        enemy.y + enemy.height
                    )
                )
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

    enemies = enemies.filter((enemy) => enemy.y < GAME_HEIGHT)
    trees = trees.filter((tree) => tree.y < GAME_HEIGHT)
    ripples = ripples.filter((ripple) => ripple.y < GAME_HEIGHT)
    obstacles = obstacles.filter((obstacle) => obstacle.y < GAME_HEIGHT)

    updateRain()
    updateGhostTrail()
    updateSmoke()
}

function draw() {
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    drawSegments()
    drawRipples()
    drawTrees()
    drawObstacles()
    drawPlayer()
    drawEnemies()
    drawSmokeParticles()
    drawRain()
    drawRainFilter()

    if (isGameOver) {
        drawGameOver()
    }
}

function gameLoop() {
    if (isGameOver || !gameStarted) {
        draw()
        if (!isGameOver) {
            drawStartScreen()
        }
        if (!gameStarted && !isGameOver && rainFilterOpacity === 0) {
            clearTimeout(rainToggleInterval)
            rainToggleInterval = null
        }
        return
    }

    update()
    draw()
    drawScores()
    requestAnimationFrame(gameLoop)
}
