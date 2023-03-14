const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const BASE_COLOR_RGB = ["67", "217", "173"];
const FIELD_SIZE = 500;
const SNAKE_PART_SIZE = 8;

let snakeParts = new Array(50)
  .fill(0)
  .map((item, index) => [index * SNAKE_PART_SIZE, 50]);

let directionStops = [];
let currentDirection = "right";

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
};

const moveSnake = () => {
  snakeParts = snakeParts.map((part, index) => {
    console.log(part)
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

setInterval(moveSnake, 30);

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowDown") {
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "bottom";
  }

  if (e.code === "ArrowRight") {
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "right";
  }

  if (e.code === "ArrowLeft") {
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "left";
  }

  if (e.code === "ArrowUp") {
    const [x, y] = snakeParts.at(-1);
    const stop = { x, y, direction: currentDirection, index: 0 };
    directionStops.push(stop);
    currentDirection = "top";
  }
});
