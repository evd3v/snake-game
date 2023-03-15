const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const BASE_COLOR_RGB = ["67", "217", "173"];
const FIELD_SIZE = 400;
const SNAKE_PART_SIZE = 8;

let snakeParts = new Array(10)
  .fill(0)
  .map((item, index) => [index * SNAKE_PART_SIZE, 50]);

let directionStops = [];
let currentDirection = "right";

let pointPosition = null;
let pointAnimationStage = 0;

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

  const opacityStep = 100 / snakeParts.length;
  for (let [index, position] of snakeParts.entries()) {
    const opacity = formatOpacity(opacityStep * (index + 1));
    drawSnakePart(position, opacity);
  }
  // animatePoint()
};


const drawPoint = () => {
  const steps = (FIELD_SIZE / SNAKE_PART_SIZE)

  const x = Math.floor(Math.random() * steps)
  const y = Math.floor(Math.random() * steps)

  pointPosition = { x, y }

  ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 1);
  ctx.beginPath();
  ctx.arc(x * SNAKE_PART_SIZE, y * SNAKE_PART_SIZE, SNAKE_PART_SIZE, 0, 2 * Math.PI, false);
  ctx.fill();
  //
  // ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 0.25);
  // ctx.beginPath();
  // ctx.arc(x * SNAKE_PART_SIZE, y * SNAKE_PART_SIZE, SNAKE_PART_SIZE + 8, 0, 2 * Math.PI, false);
  // ctx.fill();
  //
  //
  // ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 0.1);
  // ctx.beginPath();
  // ctx.arc(x * SNAKE_PART_SIZE, y * SNAKE_PART_SIZE, SNAKE_PART_SIZE + 16, 0, 2 * Math.PI, false);
  // ctx.fill();

}

const animatePoint = () => {
    ctx.clearRect(pointPosition.x * SNAKE_PART_SIZE - 24, pointPosition.y * SNAKE_PART_SIZE - 24, 48, 48);

    if(pointAnimationStage === 0) {
      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 1);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    if(pointAnimationStage === 1) {
      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 1);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE, 0, 2 * Math.PI, false);
      ctx.fill();

      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 0.25);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE + 8, 0, 2 * Math.PI, false);
      ctx.fill();
    }
    if(pointAnimationStage === 2) {
      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 1);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE, 0, 2 * Math.PI, false);
      ctx.fill();

      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 0.25);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE + 8, 0, 2 * Math.PI, false);
      ctx.fill();

      ctx.fillStyle = getRGBAColor(BASE_COLOR_RGB, 0.1);
      ctx.beginPath();
      ctx.arc(pointPosition.x * SNAKE_PART_SIZE, pointPosition.y * SNAKE_PART_SIZE, SNAKE_PART_SIZE + 16, 0, 2 * Math.PI, false);
      ctx.fill();
    }

    if(pointAnimationStage === 2) {
      pointAnimationStage = 0;
    } else {
      pointAnimationStage += 1;
    }
}

const moveSnake = () => {
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
      const isNegative = x - SNAKE_PART_SIZE <= 0
      const coord = isNegative ? FIELD_SIZE - ((x - SNAKE_PART_SIZE) * SNAKE_PART_SIZE) : (x - SNAKE_PART_SIZE) % FIELD_SIZE)
      coords = [coord, y];
    }

    if (direction === "top") {
      const isNegative = y - SNAKE_PART_SIZE <= 0
      const coord = isNegative ? FIELD_SIZE - ((y - SNAKE_PART_SIZE) * SNAKE_PART_SIZE) : (y - SNAKE_PART_SIZE) % FIELD_SIZE)
      coords = [x, coord];
    }

    return coords;
  });
  drawSnake();
  directionStops = directionStops.map((stop) => ({
    ...stop,
    index: stop.index + 1,
  }));
};

drawSnake();
drawPoint();

setInterval(moveSnake, 30);
// setInterval(animatePoint, 30)

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowDown") {
    if(currentDirection === 'top' || currentDirection === 'bottom') {
      return
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "bottom";
  }

  if (e.code === "ArrowRight") {
    if(currentDirection === 'left' || currentDirection === 'right') {
      return
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "right";
  }

  if (e.code === "ArrowLeft") {
    if(currentDirection === 'left' || currentDirection === 'right') {
      return
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "left";
  }

  if (e.code === "ArrowUp") {
    if(currentDirection === 'top' || currentDirection === 'bottom') {
      return
    }
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "top";
  }
});
