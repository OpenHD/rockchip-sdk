export const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

export const floodFill = (ctx: CanvasRenderingContext2D, startX: number, startY: number, fillColorStr: string) => {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const stack = [{ x: Math.floor(startX), y: Math.floor(startY) }];
  const targetColorIndex = (stack[0].y * width + stack[0].x) * 4;
  
  const startR = data[targetColorIndex];
  const startG = data[targetColorIndex + 1];
  const startB = data[targetColorIndex + 2];
  const startA = data[targetColorIndex + 3];

  const fillRgb = hexToRgb(fillColorStr);
  const fillR = fillRgb.r;
  const fillG = fillRgb.g;
  const fillB = fillRgb.b;
  const fillA = 255;

  // Si el color ya es el mismo, nos salimos
  if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) {
    return;
  }

  const matchStartColor = (pixelPos: number) => {
    return (
      data[pixelPos] === startR &&
      data[pixelPos + 1] === startG &&
      data[pixelPos + 2] === startB &&
      data[pixelPos + 3] === startA
    );
  };

  const colorPixel = (pixelPos: number) => {
    data[pixelPos] = fillR;
    data[pixelPos + 1] = fillG;
    data[pixelPos + 2] = fillB;
    data[pixelPos + 3] = fillA;
  };

  while (stack.length > 0) {
    const p = stack.pop();
    if (!p) continue;
    let { x, y } = p;

    let currentPixel = (y * width + x) * 4;
    while (y >= 0 && matchStartColor(currentPixel)) {
      y--;
      currentPixel -= width * 4;
    }
    
    y++;
    currentPixel += width * 4;

    let reachLeft = false;
    let reachRight = false;

    while (y < height && matchStartColor(currentPixel)) {
      colorPixel(currentPixel);

      if (x > 0) {
        if (matchStartColor(currentPixel - 4)) {
          if (!reachLeft) {
            stack.push({ x: x - 1, y });
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (x < width - 1) {
        if (matchStartColor(currentPixel + 4)) {
          if (!reachRight) {
            stack.push({ x: x + 1, y });
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }

      currentPixel += width * 4;
      y++;
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

export const initCanvasWhite = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
};
