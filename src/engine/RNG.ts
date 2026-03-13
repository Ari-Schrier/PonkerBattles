/**
 * RNG - Deterministic Random Number Generator
 * Implements a seeded pseudorandom number generator for deterministic gameplay
 * Uses Linear Congruential Generator (LCG) algorithm
 * 
 * This enables:
 * - Server-side validation of client actions
 * - Replay functionality with identical outcomes
 * - Debugging with reproducible random sequences
 */

export class RNG {
  private seed: number;
  private current: number;

  // LCG parameters (from Numerical Recipes)
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private readonly m = 2 ** 32;

  /**
   * Create a new RNG instance
   * @param seed - Initial seed value. If not provided, uses current timestamp (non-deterministic)
   */
  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
    this.current = this.seed;
  }

  /**
   * Get the current seed value
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Reset the RNG to its initial seed
   */
  reset(): void {
    this.current = this.seed;
  }

  /**
   * Set a new seed and reset the generator
   */
  setSeed(seed: number): void {
    this.seed = seed;
    this.current = seed;
  }

  /**
   * Generate next random number in sequence
   * Returns a value between 0 (inclusive) and 1 (exclusive)
   */
  next(): number {
    this.current = (this.a * this.current + this.c) % this.m;
    return this.current / this.m;
  }

  /**
   * Generate a random integer between min (inclusive) and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    const range = max - min + 1;
    return Math.floor(this.next() * range) + min;
  }

  /**
   * Generate a random float between min (inclusive) and max (exclusive)
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Roll a die with the specified number of sides
   * @param sides - Number of sides on the die
   * @returns A value between 1 and sides (inclusive)
   */
  rollDie(sides: number): number {
    return this.nextInt(1, sides);
  }

  /**
   * Roll multiple dice and return the sum
   * @param count - Number of dice to roll
   * @param sides - Number of sides on each die
   * @returns Sum of all dice rolls
   */
  rollDice(count: number, sides: number): number {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += this.rollDie(sides);
    }
    return total;
  }

  /**
   * Pick a random element from an array
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    const index = this.nextInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Global unseeded RNG instance for client-side use
 * This uses Math.random() behavior but through the RNG interface
 */
export const globalRNG = new RNG();