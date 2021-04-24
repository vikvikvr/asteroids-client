export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  width: number;
  height: number;
};

export type Collidable = {
  hitBoxRadius: number;
  coords: Point;
};

export function centerOf(rect: Rect): Point {
  return {
    x: rect.width / 2,
    y: rect.height / 2
  };
}

export function distance(obj1: Point, obj2: Point): number {
  let deltaX = obj1.x - obj2.x;
  let deltaY = obj1.y - obj2.y;
  return Math.sqrt(deltaX ** 2 + deltaY ** 2);
}

export function haveCollided(obj1: Collidable, obj2: Collidable): boolean {
  let dist = distance(obj1.coords, obj2.coords);
  let minDistance = obj1.hitBoxRadius + obj2.hitBoxRadius;
  return dist < minDistance;
}

export function randomCoordsFarFrom(
  object: Collidable,
  world: Rect,
  hitBoxMultiplier = 2
): Point {
  let distFromObject, coords;
  let tries = 0;
  do {
    if (tries > 100) throw Error('Could not create randomCoordsFarFrom');
    tries++;
    coords = {
      x: Math.random() * world.width,
      y: Math.random() * world.height
    };
    distFromObject = distance(coords, object.coords);
  } while (distFromObject < object.hitBoxRadius * hitBoxMultiplier);

  return coords;
}

export function notDirection(
  direction: number,
  coneAngle: number,
  random: () => number
): number {
  if (direction < 0) direction += Math.PI;

  let dir: number;
  do {
    dir = random() * Math.PI * 2;
  } while (Math.abs(dir - direction) <= coneAngle / 2);
  return dir;
}

function tryPuttingValueInsideRange(
  value: number,
  adjustment: number,
  max: number,
  min = 0
): number {
  if (value < min) {
    return value + adjustment;
  } else if (value > max) {
    return value - adjustment;
  } else {
    return value;
  }
}

function mostVisibleCoords(
  screenCoords: Point,
  world: Rect,
  screen: Rect
): Point {
  let bestX = tryPuttingValueInsideRange(
    screenCoords.x,
    world.width,
    screen.width
  );
  let bestY = tryPuttingValueInsideRange(
    screenCoords.y,
    world.height,
    screen.height
  );

  return {
    x: bestX,
    y: bestY
  };
}

function isBetween(value: number, max: number, min = 0): boolean {
  return value >= min && value <= max;
}

// assuming origin is always drawn in the middle of the screen
export function drawableCoords(
  object: Point,
  origin: Point,
  screen: Rect,
  world: Rect,
  showAlways?: boolean
): Point | undefined {
  let deltaX = object.x - origin.x;
  let deltaY = object.y - origin.y;
  let screenX = screen.width / 2 + deltaX;
  let screenY = screen.height / 2 + deltaY;
  let screenCoords = { x: screenX, y: screenY };

  if (showAlways) return screenCoords;

  let result = mostVisibleCoords(screenCoords, world, screen);
  if (!isBetween(result.x, screen.width)) return undefined;
  if (!isBetween(result.y, screen.height)) return undefined;
  return result;
}
