import { AsteroidSize } from './Asteroid';
import { GameTemperature } from './GameEngine';

const SCORES = [200, 100, 50];

export function bulletHitScore(
  size: AsteroidSize,
  temperature: GameTemperature
): number {
  const [small, medium, large] = SCORES;
  let score = SCORES[size];
  if (temperature === 'low') {
    if (size === 2) return large + medium * 2 + small * 4;
    if (size === 1) return medium + small * 2;
    return small;
  } else if (temperature === 'high') {
    return score * 2;
  }
  return score;
}

export function getHighScore(): number {
  const bestScore = localStorage.getItem('asteroids-highscore') || '0';
  return JSON.parse(bestScore);
}

export function saveHighScore(score: number, highScore: number): void {
  if (score > highScore) {
    localStorage.setItem('asteroids-highscore', score.toString());
  }
}
