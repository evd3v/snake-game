const canvas = document.querySelector("#game");

const ctx = canvas.getContext("2d");

const arr = new Array(50).fill(0).map((item, index) => index);

const rectSize = 8;

let rectOffset = 0;
let rectXOffset = 0;

let direction = "bottom";
let changeDirectionIndex = 0;
let changeDirection = false;

const drawSnake = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let index in arr) {
    const opacity = index * 2 < 10 ? `0.0${index * 2}` : `0.${index * 2}`;

    let verticalPosition = 50 + rectOffset;
    let horizontalPosition = 50 + rectXOffset;

    if (direction === "bottom" || direction === "top") {
      let position = verticalPosition;

      if (
        (changeDirection && changeDirectionIndex >= index) ||
        !changeDirection
      ) {
        position += index * rectSize;
      }

      if (position > 500) {
        position = position % 500;
      }

      ctx.fillStyle = `rgba(67,217,173,${opacity})`;
      ctx.fillRect(horizontalPosition, position, rectSize, rectSize);
    } else {
      let position = rectXOffset;
      let vposition = rectOffset;

      if (changeDirection && index >= 50 - changeDirectionIndex) {
        vposition += index * rectSize;
      } else {
        position += (50 - index) * rectSize;
      }

      if (verticalPosition > 500) {
        verticalPosition = verticalPosition % 500;
      }

      if (position > 500) {
        position = position % 500;
      }

      ctx.fillStyle = `rgba(67,217,173,${opacity})`;
      ctx.fillRect(position, vposition, rectSize, rectSize);
    }

    // const verticalPosition = 50 + rectOffset + index * rectSize;
    //
    // const isHorizontalPosition = direction === 1 && changeDirectionIndex !== 49;
    //
    // let horizontalPosition = 50;
    //
    // if (isHorizontalPosition) {
    //   if (index >= changeDirectionIndex) {
    //     horizontalPosition = 50 + index * rectSize;
    //   }
    // }
  }

  if (direction === "top" || direction === "bottom") {
    rectOffset += rectSize;
  } else {
    rectXOffset += rectSize;
  }

  if (changeDirection) {
    changeDirectionIndex += 1;
  }
  // rectOffset += rectSize;
};

setInterval(() => {
  drawSnake();
}, 1000);

setTimeout(() => {
  direction = "right";
  changeDirection = true;
}, 1000);
