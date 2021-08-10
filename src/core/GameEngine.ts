/* eslint-disable no-unused-vars */
import Ship from './Ship';
import Asteroid from './Asteroid';
import { haveCollided, centerOf, randomIndex } from 'lib/geometry';
import * as ev from './Events';
import { remove, find } from 'lodash';
import Spawner from './Spawner';
import { bulletHitScore, getHighScore, saveHighScore } from './game-rules';
import Shard from './Shard';
import { AsteroidSize, GameState, GameStatus, Rect, Temperature } from 'types';

class GameEngine {
  // public
  public state: GameState;
  public status: GameStatus = 'idle';
  public world: Rect;
  public spawner: Spawner;
  public levelDuration = 30_000;
  public highScore: number;
  // private
  // eslint-disable-next-line no-undef
  private updateTimeout?: NodeJS.Timeout;
  // eslint-disable-next-line no-undef
  private levelTimeout?: NodeJS.Timeout;
  constructor(world: Rect) {
    this.state = {
      asteroids: [],
      events: [],
      shards: [],
      ship: new Ship({ world, coords: centerOf(world) }),
      score: 0,
      level: 0,
      temperature: Temperature.Normal
    };
    this.highScore = getHighScore();
    this.world = world;
    this.spawner = new Spawner(this.state, this.world);
    this.update = this.update.bind(this);
    this.updateLevel = this.updateLevel.bind(this);
  }

  public startLevel(): void {
    this.status = 'playing';
    this.updateLevel();
    this.updateTimeout = setInterval(this.update, 16);
    this.levelTimeout = setInterval(this.updateLevel, this.levelDuration);
  }

  private update(): void {
    this.state.ship.update(this.state.temperature);
    this.updateAsteroids();
    this.updateShards();
    this.checkCollisions();
    this.checkGameLost();
  }

  private checkGameLost(): void {
    const haveLost = this.state.ship.life <= 0;
    if (haveLost) {
      this.status = 'lost';
      saveHighScore(this.state.score, this.highScore);
      this.stopUpdating();
      this.stopLevelingUp();
    }
  }

  private stopLevelingUp(): void {
    if (this.levelTimeout) {
      clearInterval(this.levelTimeout);
    }
  }

  private stopUpdating(): void {
    if (this.updateTimeout) {
      clearInterval(this.updateTimeout);
    }
  }

  private updateAsteroids(): void {
    const { temperature, asteroids } = this.state;
    for (const asteroid of asteroids) {
      asteroid.update(temperature);
    }
  }

  private updateShards(): void {
    for (const shard of this.state.shards) {
      shard.update();
    }
    remove(this.state.shards, 'isExpired');
  }

  private checkCollisions(): void {
    this.checkAsteroidBulletCollisions();
    this.checkAsteroidShipCollisions();
  }

  private checkAsteroidBulletCollisions(): void {
    const { asteroids, ship, events } = this.state;
    for (const asteroid of asteroids) {
      for (const bullet of ship.bullets) {
        if (haveCollided(asteroid, bullet)) {
          const event = new ev.BulletHit(
            bullet,
            asteroid,
            this.state.temperature === Temperature.Low
          );
          this.createExplosionShards(asteroid);
          events.push(event);
          this.processBulletHit(event);
          this.assignScore(event);
        }
      }
    }
  }

  private checkAsteroidShipCollisions(): void {
    const { asteroids, ship, events } = this.state;
    for (const asteroid of asteroids) {
      if (haveCollided(asteroid, ship)) {
        const event = new ev.ShipHit(asteroid);
        this.createExplosionShards(asteroid);
        events.push(event);
        this.processShipHit(event);
      }
    }
  }

  private createExplosionShards(asteroid: Asteroid): void {
    const shardsCount = asteroid.size * 10 + 10;
    for (let i = 0; i < shardsCount; i++) {
      this.state.shards.push(
        new Shard({
          colorIndex: randomIndex(4),
          size: asteroid.size,
          coords: asteroid.coords,
          world: this.world,
          temperature: this.state.temperature
        })
      );
    }
  }

  private processBulletHit(event: ev.BulletHit): void {
    const { asteroids, ship, temperature } = this.state;
    const asteroid = find(asteroids, { id: event.asteroidId });
    if (asteroid) {
      const nextSize = asteroid.splitSize();
      const shouldSplit = temperature !== Temperature.Low;
      if (shouldSplit && nextSize !== null) {
        this.spawner.spawnAsteroid({
          count: 2,
          size: nextSize,
          coords: asteroid.coords,
          notDirection: ship.direction
        });
      }
      remove(asteroids, { id: event.asteroidId });
    }
    ship.removeBullet(event.bulletId, temperature);
  }

  private assignScore(event: ev.BulletHit): void {
    const scoreToAdd = bulletHitScore(event.size, this.state.temperature);
    this.state.score += scoreToAdd;
  }

  private updateLevel(): void {
    const spawnTime = this.levelDuration / 3;
    setTimeout(() => this.startFrozenStage(), spawnTime);
    setTimeout(() => this.startBurningStage(), spawnTime * 2);
    this.levelUp();
  }

  private levelUp(): void {
    this.state.temperature = Temperature.Normal;
    const count = Math.floor(20 + this.state.level * 1.5);
    this.spawner.spawnAsteroid({ count, size: AsteroidSize.Large });
    if (this.state.level > 0) {
      const event = new ev.GameEvent('LEVEL_UP', this.state.ship.coords);
      this.state.events.push(event);
    }
    this.state.level++;
  }

  private startBurningStage(): void {
    this.state.temperature = Temperature.High;
    const event = new ev.GameEvent('BURN', this.state.ship.coords);
    this.state.events.push(event);
  }

  private startFrozenStage(): void {
    this.state.temperature = Temperature.Low;
    const event = new ev.GameEvent('FREEZE', this.state.ship.coords);
    this.state.events.push(event);
  }

  private processShipHit(event: ev.ShipHit): void {
    const { asteroids, ship } = this.state;
    remove(asteroids, { id: event.asteroidId });
    ship.life -= event.damage;
  }
}

export default GameEngine;
