import { Point, Rect } from '../lib/geometry';
import GameObject from './GameObject';

interface BulletOptions {
  world: Rect;
  direction: number;
  coords: Point;
  speed: number;
}

class Bullet extends GameObject {
  constructor(options: BulletOptions) {
    super({
      ...options,
      type: 'bullet',
      hitBoxRadius: 3,
      duration: 1500,
      tailLength: 15
    });
  }
}

export default Bullet;
