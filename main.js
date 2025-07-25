const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

const GAME_WIDTH = 800
const GAME_HEIGHT = 600

canvas.width = GAME_WIDTH
canvas.height = GAME_HEIGHT

const playerImage = new Image()
playerImage.src = 'player.png'

const obstacleImage = new Image()
obstacleImage.src = 'banana.png'

const treeImage = new Image()
treeImage.src = 'tree.png'

let imagesLoaded = 0
const totalImages = 3

function onImageLoad() {
    imagesLoaded++
    if (imagesLoaded === totalImages) {
        gameLoop()
    }
}

playerImage.onload = onImageLoad
obstacleImage.onload = onImageLoad
treeImage.onload = onImageLoad

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
    shoulderColor: '#444',
}

const MAX_ROAD_SPEED = 5

let player = { ...INITIAL_PLAYER_STATE }
let road = { ...INITIAL_ROAD_STATE }

let ghostTrail = []
const GHOST_LENGTH = 8

const pressedKeys = {}

let roadSegments = []
const MAX_ROAD_WIDTH = 448
const MIN_ROAD_WIDTH = 256

for (let i = 0; i < GAME_HEIGHT / road.segmentHeight + 2; i++) {
    roadSegments.push({
        y: i * road.segmentHeight,
        width: road.width,
        x: (GAME_WIDTH - road.width) / 2,
    })
}

let obstacles = []
const OBSTACLE_MIN_WIDTH = 24
const OBSTACLE_MAX_WIDTH = 48
const INITIAL_OBSTACLE_SPAWN_INTERVAL = 48
let obstacle_spanw_interval = INITIAL_OBSTACLE_SPAWN_INTERVAL
const MIN_OBSTACLE_SPAWN_RATE = 8
let segmentsSinceLastObstacle = 0

const TREE_SPAWN_INTERVAL = 16
let segmentsSinceLastTree = 0
const TREE_WIDTH = 64
const TREE_HEIGHT = 64
let trees = []

let score = 0
let highScore = parseInt(localStorage.getItem('highScore')) || 0
let newHighScoreAchieved = false
let isGameOver = false
let gameStarted = false
let speedIncreasedForThisMilestone = false

function resetGame() {
    player = { ...INITIAL_PLAYER_STATE }
    road = { ...INITIAL_ROAD_STATE }

    roadSegments = []
    for (let i = 0; i < GAME_HEIGHT / road.segmentHeight + 2; i++) {
        roadSegments.push({
            y: i * road.segmentHeight,
            width: road.width,
            x: (GAME_WIDTH - road.width) / 2,
        })
    }

    obstacles = []
    trees = []
    score = 0
    segmentsSinceLastObstacle = 0
    obstacle_spanw_interval = INITIAL_OBSTACLE_SPAWN_INTERVAL
    isGameOver = false
    newHighScoreAchieved = false
    speedIncreasedForThisMilestone = false
    ghostTrail = []

    gameLoop()
}

document.addEventListener('keydown', (e) => {
    pressedKeys[e.key] = true
    if ((isGameOver && e.key === 'r') || e.key === 'R') {
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
        rect1.x < rect2.x + rect2.width - 4 &&
        rect1.x + rect1.width + 4 > rect2.x &&
        rect1.y < rect2.y + rect2.height - 4 &&
        rect1.y + rect1.height + 4 > rect2.y
    )
}

function generateRoadSegment(previousSegment) {
    const minWidthChange = -16
    const maxWidthChange = 16
    const maxOffsetChange = 24

    let newWidth =
        previousSegment.width +
        (Math.random() * (maxWidthChange - minWidthChange) + minWidthChange)
    newWidth = Math.max(Math.min(MAX_ROAD_WIDTH, newWidth), MIN_ROAD_WIDTH)

    let newX =
        previousSegment.x +
        (Math.random() * (maxOffsetChange * 2) - maxOffsetChange)
    newX = Math.max(48, Math.min(GAME_WIDTH - newWidth - 48, newX))

    return {
        y: previousSegment.y - road.segmentHeight,
        width: newWidth,
        x: newX,
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

function update() {
    if (isGameOver) {
        return
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

    if (roadSegments[0].y > GAME_HEIGHT) {
        roadSegments.shift()
        const lastSegment = roadSegments[roadSegments.length - 1]
        roadSegments.push(generateRoadSegment(lastSegment))

        score++

        segmentsSinceLastObstacle++
        if (segmentsSinceLastObstacle >= obstacle_spanw_interval) {
            const spawnSegment = roadSegments[roadSegments.length - 1]
            if (spawnSegment) {
                obstacles.push(generateObstacle(spawnSegment))
                segmentsSinceLastObstacle = 0
            }
        }

        segmentsSinceLastTree++
        if (segmentsSinceLastTree >= TREE_SPAWN_INTERVAL) {
            const spawnSegment = roadSegments[roadSegments.length - 1]
            if (spawnSegment) {
                trees.push(generateTree(spawnSegment))
                segmentsSinceLastTree = 0
            }
        }
    }

    trees = trees.filter((tree) => tree.y < GAME_HEIGHT)

    if (score > 0 && score % 100 === 0 && !speedIncreasedForThisMilestone) {
        if (road.speed < MAX_ROAD_SPEED) {
            road.speed = parseFloat((road.speed + 0.5).toFixed(1))
        }
        if (obstacle_spanw_interval > MIN_OBSTACLE_SPAWN_RATE) {
            obstacle_spanw_interval -= 2
        }
        speedIncreasedForThisMilestone = true
    } else if (score % 100 !== 0) {
        speedIncreasedForThisMilestone = false
    }

    for (let i = 0; i < obstacles.length; i++) {
        if (checkCollision(player, obstacles[i])) {
            isGameOver = true

            if (score > highScore) {
                highScore = score
                localStorage.setItem('highScore', highScore)
                newHighScoreAchieved = true
            }
        }
    }

    obstacles = obstacles.filter((obstacle) => obstacle.y < GAME_HEIGHT)

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

            if (score > highScore) {
                highScore = score
                localStorage.setItem('highScore', highScore)
                newHighScoreAchieved = true
            }
        }
    }
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
    ctx.fillStyle = 'white'
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
            roundedY + obstacle.height - 4,
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
    ctx.save()
    ctx.filter = 'blur(4px)'
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.beginPath()
    ctx.ellipse(
        player.x + player.width / 2,
        roundedPlayerY + player.height - 16,
        player.width / 2.4,
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

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    ctx.fillStyle = 'white'
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
    ctx.fillStyle = 'white'
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
    ctx.fillStyle = 'white'
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
        ctx.fillStyle = '#f1f1f1ff'
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

function draw() {
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    drawSegments()
    drawTrees()
    drawObstacles()
    drawPlayer()

    if (isGameOver) {
        drawGameOver()
    }
}

function gameLoop() {
    if (isGameOver) {
        draw()
        return
    }

    if (!gameStarted) {
        draw()
        drawStartScreen()
        return
    }

    update()
    draw()
    drawScores()
    requestAnimationFrame(gameLoop)
}
