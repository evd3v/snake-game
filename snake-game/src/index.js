const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const BASE_COLOR_RGB = ["67", "217", "173"];
const FIELD_SIZE = 400;
const SNAKE_PART_SIZE = 8;

let snakeParts = new Array(10)
  .fill(0)
  .map((item, index) => [index * SNAKE_PART_SIZE, 80]);

let directionStops = [];
let currentDirection = "right";
let isAnimationStop = false;

let pointPosition = {
  x: Math.floor(Math.random() * 50) * 8,
  y: Math.floor(Math.random() * 50) * 8,
};

let pointAnimationStage = 1;

const getRGBAColor = (rgb, opacity) => {
  return `rgba(${rgb.join(",")}, ${opacity})`;
};

const formatOpacity = (value) => {
  if (value === 100) return "1.00";
  if (value < 10) return `0.0${value}`;
  return `0.${value}`;
};

const drawSnakePart = (position, opacity) => {
  const [x, y] = position;
  ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, opacity);
  ctx.fillRect(x, y, SNAKE_PART_SIZE, SNAKE_PART_SIZE);
};

const drawSnake = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const opacityStep = Math.floor(100 / snakeParts.length);

  for (let [index, position] of snakeParts.entries()) {
    const opacity = formatOpacity(opacityStep * (index + 1));
    drawSnakePart(position, opacity);
  }
  animatePoint();
};

const drawPoint = () => {};

const animatePoint = () => {
  const animateSteps = 3;
  const opacityStep = 0.2;

  for (let i = 0; i < pointAnimationStage; i++) {
    ctx.fillStyle = getRGBAColor(
      BASE_COLOR_RGB,
      i ? (animateSteps - i) * opacityStep : 1
    );
    ctx.beginPath();
    ctx.arc(
      pointPosition.x + 4,
      pointPosition.y + 4,
      SNAKE_PART_SIZE / 2 + i * 4,
      0,
      2 * Math.PI,
      false
    );
    ctx.fill();

    if (animateSteps === i) {
      isAnimationStop = true;

      setTimeout(() => {
        isAnimationStop = false;
      }, 360);
    }
  }
};

const moveSnake = () => {
  const [xSnake, ySnake] = snakeParts.at(-1);
  const [xSnakeTail, ySnakeTail] = snakeParts.at(0);
  const { x: xPoint, y: yPoint } = pointPosition;

  snakeParts = snakeParts.map((part, index) => {
    const [x, y] = part;
    let direction = currentDirection;

    if (directionStops.length) {
      const stopIndex = directionStops.findIndex(
        (stop) => snakeParts.length - 1 - stop.index >= index
      );
      if (stopIndex !== -1) {
        direction = directionStops[stopIndex].direction;
      }
    }

    let coords = [];

    if (direction === "bottom") {
      coords = [x, (y + SNAKE_PART_SIZE) % FIELD_SIZE];
    }

    if (direction === "right") {
      coords = [(x + SNAKE_PART_SIZE) % FIELD_SIZE, y];
    }

    if (direction === "left") {
      const isNegative = x - SNAKE_PART_SIZE <= 0;
      const coord = isNegative
        ? FIELD_SIZE - (x - SNAKE_PART_SIZE) * SNAKE_PART_SIZE
        : (x - SNAKE_PART_SIZE) % FIELD_SIZE;
      coords = [coord, y];
    }

    if (direction === "top") {
      const isNegative = y - SNAKE_PART_SIZE <= 0;
      const coord = isNegative
        ? FIELD_SIZE - (y - SNAKE_PART_SIZE) * SNAKE_PART_SIZE
        : (y - SNAKE_PART_SIZE) % FIELD_SIZE;
      coords = [x, coord];
    }

    return coords;
  });

  drawSnake();
  directionStops = directionStops.map((stop) => ({
    ...stop,
    index: stop.index + 1,
  }));

  if (xSnake === xPoint && ySnake === yPoint) {
    snakeParts.unshift([xSnakeTail, ySnakeTail]);

    pointPosition = {
      x: Math.floor(Math.random() * 50) * 8,
      y: Math.floor(Math.random() * 50) * 8,
    };
  }
};

drawPoint();
drawSnake();

setInterval(moveSnake, 40);

setInterval(() => {
  if (isAnimationStop) {
    pointAnimationStage = 1;
    return;
  }

  pointAnimationStage += 1;
}, 120);

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowDown") {
    if (currentDirection === "top" || currentDirection === "bottom") {
      return;
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "bottom";
  }

  if (e.code === "ArrowRight") {
    if (currentDirection === "left" || currentDirection === "right") {
      return;
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "right";
  }

  if (e.code === "ArrowLeft") {
    if (currentDirection === "left" || currentDirection === "right") {
      return;
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "left";
  }

  if (e.code === "ArrowUp") {
    if (currentDirection === "top" || currentDirection === "bottom") {
      return;
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "top";
  }
});
