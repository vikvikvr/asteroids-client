import GameEngine, { GameTemperature } from '../core/GameEngine';
import P5 from 'p5';
import { drawableCoords, Point, Rect } from '../lib/geometry';
import GUI from './GUI';
import COLORS from './colors';
import Animation, {
  ImageAnimation,
  OverlayAnimation,
  OverlayAnimationColor,
  TextAnimation
} from './Animation';
import Ship from '../core/Ship';
import { remove } from 'lodash';
import { bulletHitScore } from '../core/game-rules';
import { BulletHit, GameEvent, GotBonus, ShipHit } from '../core/Events';
import Drop from '../core/Drop';
import Asteroid from '../core/Asteroid';
import Bullet from '../core/Bullet';
import {
  drawAsteroidShape,
  drawAsteroidTailShape,
  drawBulletShape,
  drawBulletTailShape,
  drawShipLifeArcShape,
  drawShipShape,
  drawShipTailShape
} from './shapes';
import { drawExplostionShard, drawTextAnimation } from './animations';

interface DrawGameObjectOptions {
  image: P5.Image;
  rotateDirection?: boolean;
  ignoreOrientation?: boolean;
  rotationOffset?: number;
  scale?: number;
}

interface DrawerOptions {
  p5: P5;
  engine: GameEngine;
  rootElementId: string;
  showHitBoxes?: boolean;
}

export interface DrawableObject {
  coords: Point;
  hitBoxRadius: number;
  orientation: number;
  direction: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
}

class Drawer {
  // private
  private p5: P5;
  private stars: Star[] = [];
  private showHitBoxes: boolean;
  private screen: Rect;
  private engine: GameEngine;
  private gui: GUI;
  private animations: Animation[] = [];
  private shakeEndTime: number;
  // constructor
  constructor(options: DrawerOptions) {
    this.p5 = options.p5;
    const canvas = this.p5.createCanvas(
      this.p5.windowWidth,
      this.p5.windowHeight
    );
    this.engine = options.engine;
    canvas.parent(options.rootElementId);
    this.showHitBoxes = options.showHitBoxes || false;
    this.screen = {
      width: this.p5.windowWidth,
      height: this.p5.windowHeight
    };
    this.gui = new GUI(this.p5, COLORS);
    this.p5.textSize(20);
    this.shakeEndTime = -Infinity;
  }

  public drawScreen(engine: GameEngine): void {
    switch (engine.status) {
      case 'playing':
        this.drawGameScreen(engine);
        break;
      case 'lost':
        this.drawGameOverScreen(engine.state.score);
        break;
      case 'won':
        this.drawGameWonScreen(engine.state.score);
        break;
      case 'idle':
        console.log('idle');
        break;
    }
  }

  public resizeScreen(width: number, height: number): void {
    this.p5.resizeCanvas(width, height);
    this.screen = { width, height };
  }

  private drawGameScreen(engine: GameEngine): void {
    this.p5.push();
    const currentTime = Date.now();
    if (currentTime < this.shakeEndTime) {
      const shakeSize = 10;
      const offsetX = this.p5.noise(currentTime) * shakeSize;
      const offsetY = this.p5.noise(0, currentTime) * shakeSize;
      this.p5.translate(offsetX, offsetY);
    }
    this.drawEnvironment();
    this.drawGameObjects(engine);
    this.addNewAnimations(engine);
    this.drawAnimations();
    this.p5.pop();
    this.gui.draw(engine);
  }

  private drawGameOverScreen(score: number): void {
    let { p5 } = this;
    p5.background(COLORS.space);
    p5.fill('yellow');
    p5.textAlign(p5.CENTER);
    p5.text('GAME OVER', p5.windowWidth / 2, p5.windowHeight / 2);
    p5.text(score, p5.windowWidth / 2, p5.windowHeight / 2 + 30);
    p5.text(
      'press F5 to try again',
      p5.windowWidth / 2,
      p5.windowHeight / 2 + 60
    );
    p5.textAlign(p5.LEFT);
  }

  private drawGameWonScreen(score: number): void {
    let { p5 } = this;
    p5.background(COLORS.space);
    p5.fill('yellow');
    p5.textAlign(p5.CENTER);
    p5.text('GAME WON!', p5.windowWidth / 2, p5.windowHeight / 2);
    p5.text(score, p5.windowWidth / 2, p5.windowHeight / 2 + 30);
    p5.text(
      'press F5 to try again',
      p5.windowWidth / 2,
      p5.windowHeight / 2 + 60
    );
    p5.textAlign(p5.LEFT);
  }

  private drawEnvironment(): void {
    let { p5, stars, engine } = this;
    const bgColorMap: Record<GameTemperature, string> = {
      high: '#2E0F16',
      normal: '#03164E',
      low: '#202946'
    };
    p5.background(bgColorMap[engine.state.temperature]);
    this.drawStars(stars);
  }

  private drawGameObjects(engine: GameEngine): void {
    let { ship, bonuses, asteroids } = engine.state;
    this.drawBullets(ship.bullets);
    this.drawShip(ship);
    this.drawBonuses(bonuses);
    this.drawAsteroids(asteroids, engine.state.temperature);
  }

  private addNewAnimations(engine: GameEngine): void {
    for (const event of engine.state.events) {
      if (event.type === 'GOT_BONUS') {
        this.addGotBonusAnimation(event);
      } else {
        this.addExplosionAnimation(event, engine.state.temperature);
        if (event.type === 'SHIP_HIT') {
          this.shakeEndTime = Date.now() + 500;
        } else {
          this.addScoreAnimation(event, engine.state.temperature);
        }
      }
    }
    engine.state.events = [];
  }

  private addScoreAnimation(event: GameEvent, temperature: GameTemperature) {
    const myEvent = event as BulletHit;
    const score = bulletHitScore(myEvent.size, temperature);
    const scoreAnimation = new TextAnimation(score.toString(), myEvent.coords);
    this.animations.push(scoreAnimation);
    // console.log('add points', score);
  }

  private addExplosionAnimation(
    event: GameEvent,
    temperature: GameTemperature
  ): void {
    const explosionScaleMap = {
      large: 1,
      medium: 0.75,
      small: 0.5
    };
    const myEvent = event as BulletHit;
    const assetKey =
      temperature === 'low' ? 'shatterAnimation' : 'explosionAnimation';
    const frames = this.assets[assetKey];
    const scale = explosionScaleMap[myEvent.size];
    const animation = new ImageAnimation(frames, myEvent.coords, scale);
    this.animations.push(animation);
  }

  private addShipHitAnimation(event: GameEvent): void {
    const myEvent = event as ShipHit;
    if (!myEvent.shielded) {
      this.animations.push(new OverlayAnimation(30, 'red'));
    }
  }

  private addGotBonusAnimation(event: GameEvent): void {
    // const myEvent = event as GotBonus;
  }

  private drawAnimations(): void {
    this.drawExplosionAnimations();
    this.drawTextAnimations();
    remove(this.animations, { isExpired: true });
  }

  private drawTextAnimations() {
    const { p5 } = this;
    p5.textSize(30);
    p5.noStroke();
    for (const animation of this.animations) {
      if (animation instanceof TextAnimation) {
        const coords = animation.getNextCoords();
        if (coords) {
          const drawable = this.toDrawableObject(coords);
          this.drawGameObject(drawable, {}, () =>
            drawTextAnimation(p5, animation)
          );
        }
      }
    }
  }

  private drawExplosionAnimations() {
    const { p5 } = this;
    for (const animation of this.animations) {
      if (animation instanceof ExplosionAnimation) {
        animation.next();
        const percent = animation.percent;
        if (percent <= 1) {
          for (const shard of animation.shards) {
            const drawer = () => drawExplostionShard(p5);
            this.drawGameObject(shard, {}, drawer);
          }
        }
      }
    }
  }

  public createStars(world: Rect, amount: number): void {
    for (let i = 0; i < amount; i++) {
      this.stars.push({
        x: Math.random() * world.width,
        y: Math.random() * world.height,
        radius: Math.random() > 0.5 ? 2 : 1
      });
    }
  }

  private drawableCoords(object: Point): Point | undefined {
    return drawableCoords(
      object,
      this.engine.state.ship.coords,
      this.screen,
      this.engine.world
    );
  }

  private drawStars(stars: Star[]): void {
    let { p5 } = this;
    p5.noStroke();
    p5.fill('white');
    for (const star of stars) {
      let coords = this.drawableCoords(star);
      coords && p5.circle(coords.x, coords.y, star.radius);
    }
  }

  private drawBonuses(bonuses: Drop[]): void {
    for (const bonus of bonuses) {
      this.drawGameObject(bonus, { image: this.assets.images[bonus.dropType] });
    }
  }

  private setGradient(c1: P5.Color, c2: P5.Color): void {
    const { p5 } = this;
    p5.noFill();
    for (var y = 0; y < p5.height; y++) {
      var inter = p5.map(y, 0, p5.height, 0, 1);
      var c = p5.lerpColor(c1, c2, inter);
      p5.stroke(c);
      p5.line(0, y, p5.width, y);
    }
  }

  private drawAsteroids(
    asteroids: Asteroid[],
    temperature: GameTemperature
  ): void {
    for (const asteroid of asteroids) {
      const side = asteroid.hitBoxRadius / 3.5;
      const options = {};
      const drawer = () => drawAsteroidShape(this.p5, side);
      this.drawGameObject(asteroid, options, drawer);
      this.drawAsteroidTail(asteroid, temperature);
    }
  }

  private toDrawableObject(point: Point): DrawableObject {
    return {
      coords: point,
      hitBoxRadius: 2,
      orientation: 0,
      direction: 0
    };
  }

  private drawGameObject(
    object: DrawableObject,
    options: DrawGameObjectOptions,
    drawer: () => void
  ): void {
    const { p5 } = this;
    const coords = this.drawableCoords(object.coords);
    if (coords) {
      const side = object.hitBoxRadius * 2;
      const orientation = options.ignoreOrientation ? 0 : object.orientation;
      const offset = options.rotationOffset || 0;
      const direction = options.rotateDirection ? object.direction : 0;
      p5.push();
      p5.translate(coords.x, coords.y);
      p5.rotate(orientation + offset + direction);
      p5.scale(options.scale || 1);
      drawer();
      if (this.showHitBoxes) {
        p5.noFill();
        p5.stroke('red');
        p5.circle(0, 0, side);
      }
      p5.pop();
    }
  }

  private drawShip(ship: Ship): void {
    this.drawShipTail(ship.tail);
    this.drawShipShield(ship.shielded);
    const options = {
      rotateDirection: true,
      rotationOffset: Math.PI / 2
    };
    const drawer = () => {
      drawShipShape(this.p5, ship.hitBoxRadius / 2);
      drawShipLifeArcShape(this.p5, ship.life);
    };
    this.drawGameObject(ship, options, drawer);
  }

  private drawShipShield(isShielded: boolean) {
    if (isShielded) {
      const { p5 } = this;
      p5.stroke(0, 255, 0, 128);
      p5.fill(0, 55, 0, 128);
      p5.circle(p5.windowWidth / 2, p5.windowHeight / 2, 80);
    }
  }

  private drawAsteroidTail(
    asteroid: Asteroid,
    temperature: GameTemperature
  ): void {
    const length = asteroid.tail.length;
    for (let i = 0; i < length; i++) {
      const point = asteroid.tail[i];
      const drawable = this.toDrawableObject(point);
      this.drawGameObject(drawable, {}, () =>
        drawAsteroidTailShape(this.p5, i, length)
      );
    }
  }

  private drawShipTail(tail: Point[]) {
    let { p5 } = this;
    const length = tail.length;
    p5.noStroke();
    for (let i = 0; i < length; i++) {
      const point = tail[i];
      const drawable = this.toDrawableObject(point);
      this.drawGameObject(drawable, {}, () => drawShipTailShape(p5, i, length));
    }
  }

  private drawBullets(bullets: Bullet[]): void {
    for (const bullet of bullets) {
      const tailLength = bullet.tailLength;
      this.drawGameObject(bullet, {}, () => drawBulletShape(this.p5));
      for (let i = 0; i < bullet.tail.length; i++) {
        const point = bullet.tail[i];
        const drawable = this.toDrawableObject(point);
        this.drawGameObject(drawable, {}, () =>
          drawBulletTailShape(this.p5, i, tailLength)
        );
      }
    }
  }
}

export default Drawer;
