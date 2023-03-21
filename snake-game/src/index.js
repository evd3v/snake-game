const EventEmitter = require("event-emitter");

const getRGBAColor = (rgb, opacity) => {
  return `rgba(${rgb.join(",")}, ${opacity})`;
};

const formatOpacity = (value) => {
  if (value === 100) return "1.00";
  if (value < 10) return `0.0${value}`;
  return `0.${value}`;
};

export class SnakeGame {
  BASE_COLOR_RGB = ["67", "217", "173"];
  SNAKE_PART_SIZE = 8;
  START_SNAKE_SIZE = 10;
  SNAKE_SPEED = 40;
  POINT_ANIMATE_STEPS = 3;
  POINT_OPACITY_STEP = 0.2;
  ANIMATION_TIMEOUT = 120;

  constructor(selector, options) {
    const { fieldHeight, fieldWidth, events } = options;

    this.canvasContext = document.querySelector(selector).getContext("2d");
    this.fieldSize = { width: fieldWidth, height: fieldHeight };

    this.$eventEmitter = new EventEmitter();
    this.events = events;

    this.initiateState();
    this.initiate();
  }

  initiateState() {
    this.directionStops = [];
    this.currentDirection = "right";
    this.isAnimationStop = false;
    this.pointAnimationStage = 1;
    this.snakeParts = [];
    this.pointPosition = [];

    this.moveInterval = null;
    this.pointAnimationInterval = null;
    this.currentScore = 0;
  }

  restart() {
    this.initiateState();
    this.initiate();
  }

  get XPoints() {
    return Math.floor(this.fieldSize.width / this.SNAKE_PART_SIZE);
  }

  get YPoints() {
    return Math.floor(this.fieldSize.height / this.SNAKE_PART_SIZE);
  }

  get snakeHead() {
    return this.snakeParts.at(-1);
  }

  get snakeTail() {
    return this.snakeParts.at(0);
  }

  initiate() {
    this.generateSnake();
    this.generatePointPosition();
    this.subscribeControlEvents();

    this.moveInterval = setInterval(
      this.moveSnake.bind(this),
      this.SNAKE_SPEED
    );
    this.pointAnimationInterval = setInterval(
      this.changePointAnimationStep.bind(this),
      this.ANIMATION_TIMEOUT
    );

    Object.entries(this.events).forEach(([event, cb]) => {
      this.$eventEmitter.on(event, cb);
    });
  }

  generateSnake() {
    const fieldXPoints = this.XPoints - this.START_SNAKE_SIZE;
    const fieldYPoints = this.YPoints;

    const startX =
      Math.floor(Math.random() * fieldXPoints) * this.SNAKE_PART_SIZE;
    const startY =
      Math.floor(Math.random() * fieldYPoints) * this.SNAKE_PART_SIZE;

    this.snakeParts = new Array(this.START_SNAKE_SIZE)
      .fill(0)
      .map((item, index) => [startX + index * this.SNAKE_PART_SIZE, startY]);
  }

  generatePointPosition() {
    this.pointPosition = [
      Math.floor(1 + Math.random() * (this.XPoints - 2)) * this.SNAKE_PART_SIZE,
      Math.floor(1 + Math.random() * (this.YPoints - 2)) * this.SNAKE_PART_SIZE,
    ];
  }

  drawSnake() {
    const { width, height } = this.fieldSize;
    this.canvasContext.clearRect(0, 0, width, height);

    const opacityStep = Math.floor(100 / this.snakeParts.length);

    for (let [index, coords] of this.snakeParts.entries()) {
      const opacity = formatOpacity(opacityStep * (index + 1));
      this.drawSnakePart(coords, opacity);
    }
    this.animatePoint();
  }

  drawSnakePart(coords, opacity) {
    const [x, y] = coords;
    this.canvasContext.fillStyle = getRGBAColor(this.BASE_COLOR_RGB, opacity);
    this.canvasContext.fillRect(
      x,
      y,
      this.SNAKE_PART_SIZE,
      this.SNAKE_PART_SIZE
    );
  }

  moveSnake() {
    const currentTail = this.snakeTail;

    this.moveSnakeParts();
    this.drawSnake();

    const isGameOver = this.checkIsGameOver();

    if (isGameOver) {
      this.onGameOver();
      return;
    }

    this.updateDirectionStops();

    this.isGetPoint = this.checkIsGetPoint();

    if (this.isGetPoint) {
      this.onGetPoint(currentTail);
    }
  }

  moveSnakeParts() {
    this.snakeParts = this.snakeParts.map((part, index) => {
      const direction = this.getSnakePartDirection(index);
      return this.getNextSnakePartPosition(part, direction);
    });
  }

  getNextSnakePartPosition(coords, direction) {
    const [x, y] = coords;
    const { width, height } = this.fieldSize;

    if (direction === "down") {
      return [x, (y + this.SNAKE_PART_SIZE) % height];
    }

    if (direction === "right") {
      return [(x + this.SNAKE_PART_SIZE) % width, y];
    }

    if (direction === "left") {
      const isNegative = x - this.SNAKE_PART_SIZE <= 0;
      const newX = isNegative
        ? width - (x - this.SNAKE_PART_SIZE) * this.SNAKE_PART_SIZE
        : (x - this.SNAKE_PART_SIZE) % width;

      return [newX, y];
    }

    if (direction === "up") {
      const isNegative = y - this.SNAKE_PART_SIZE <= 0;
      const newY = isNegative
        ? height - (y - this.SNAKE_PART_SIZE) * this.SNAKE_PART_SIZE
        : (y - this.SNAKE_PART_SIZE) % height;

      return [x, newY];
    }

    return [x, y];
  }

  addSnakePart(tailCoords) {
    const [xSnakeTail, ySnakeTail] = tailCoords;
    this.snakeParts.unshift([xSnakeTail, ySnakeTail]);
  }

  getSnakePartDirection(index) {
    let direction = this.currentDirection;

    if (this.directionStops.length) {
      const stopIndex = this.directionStops.findIndex(
        (stop) => this.snakeParts.length - 1 - stop.index >= index
      );
      if (stopIndex !== -1) {
        direction = this.directionStops[stopIndex].direction;
      }
    }

    return direction;
  }

  changeSnakeDirection(direction) {
    const isNewVertical = this.checkIsDirectionVertical(direction);
    const isNewHorizontal = this.checkIsDirectionHorizontal(direction);

    const isVertical = this.checkIsDirectionVertical(this.currentDirection);
    const isHorizontal = this.checkIsDirectionHorizontal(this.currentDirection);

    if ((isVertical && isNewVertical) || (isHorizontal && isNewHorizontal)) {
      return;
    }

    const [x, y] = this.snakeHead;
    const stop = { x, y, direction: this.currentDirection, index: 0 };
    this.directionStops.push(stop);
    this.currentDirection = direction;
  }

  updateDirectionStops() {
    this.directionStops = this.directionStops.map((stop) => ({
      ...stop,
      index: stop.index + 1,
    }));
  }

  animatePoint() {
    const [pointX, pointY] = this.pointPosition;
    for (let i = 0; i < this.pointAnimationStage; i++) {
      this.canvasContext.fillStyle = getRGBAColor(
        this.BASE_COLOR_RGB,
        i ? (this.POINT_ANIMATE_STEPS - i) * this.POINT_OPACITY_STEP : 1
      );
      this.canvasContext.beginPath();
      this.canvasContext.arc(
        pointX + this.SNAKE_PART_SIZE / 2,
        pointY + this.SNAKE_PART_SIZE / 2,
        this.SNAKE_PART_SIZE / 2 + (i * this.SNAKE_PART_SIZE) / 2,
        0,
        2 * Math.PI,
        false
      );
      this.canvasContext.fill();

      if (this.POINT_ANIMATE_STEPS === i) {
        this.isAnimationStop = true;

        setTimeout(() => {
          this.isAnimationStop = false;
        }, 360);
      }
    }
  }

  changePointAnimationStep() {
    if (this.isAnimationStop) {
      this.pointAnimationStage = 1;
      return;
    }

    this.pointAnimationStage += 1;
  }

  checkIsGameOver() {
    const [xHead, yHead] = this.snakeHead;
    const partsWithoutHead = [...this.snakeParts].splice(
      0,
      this.snakeParts.length - 2
    );
    return partsWithoutHead.some(([x, y]) => x === xHead && y === yHead);
  }

  checkIsDirectionVertical(direction) {
    return direction === "up" || direction === "down";
  }

  checkIsDirectionHorizontal(direction) {
    return direction === "left" || direction === "right";
  }

  checkIsGetPoint() {
    const [xHead, yHead] = this.snakeHead;
    const [xPoint, yPoint] = this.pointPosition;
    return xHead === xPoint && yHead === yPoint;
  }

  onGameOver() {
    clearInterval(this.moveInterval);
    this.moveInterval = null;
    clearInterval(this.pointAnimationInterval);
    this.pointAnimationInterval = null;
    this.$eventEmitter.emit("onGameOver");
  }

  addScore() {
    this.currentScore += 1;
    this.$eventEmitter.emit("onUpdateScore", this.currentScore);
  }

  onGetPoint(currentTail) {
    this.addSnakePart(currentTail);
    this.generatePointPosition();
    this.addScore();
  }

  subscribeControlEvents() {
    window.addEventListener("keydown", (e) => {
      if (!e.code.includes("Arrow")) {
        return;
      }
      const direction = e.code.split("Arrow")[1].toLowerCase();
      this.changeSnakeDirection(direction);
    });
  }
}

window.snakeGame = new SnakeGame("#game", {
  fieldHeight: 400,
  fieldWidth: 400,
  events: {
    onGameOver() {
      console.log("game over");
      // snakeGame.restart();
    },
    onUpdateScore(score) {
      console.log("update score", score);
    },
  },
});
