/**
 * Storage Repository Interfaces - Phase 3
 * 
 * Abstract interfaces for match and turn history persistence.
 * Actual implementations (Cosmos DB, Blob Storage) will be provided later in Phase 4.
 */

import type { Match, TurnEvent } from './schemas.js';

// ============================================================================
// MATCH REPOSITORY
// ============================================================================

/**
 * Repository for storing and retrieving active match state
 * 
 * Implementation notes:
 * - Should support optimistic concurrency via ETags/version numbers
 * - Should provide efficient queries by playerId
 * - Primary implementation target: Azure Cosmos DB (SQL API)
 */
export interface IMatchRepository {
  /**
   * Create a new match
   * @throws Error if match with same ID already exists
   */
  create(match: Match): Promise<Match>;
  
  /**
   * Get a match by ID
   * @returns Match or null if not found
   */
  getById(matchId: string): Promise<Match | null>;
  
  /**
   * Update an existing match with optimistic concurrency
   * @param match - Match with updated state and version
   * @param expectedVersion - Expected current version (for optimistic locking)
   * @returns Updated match with new ETag/version
   * @throws ConcurrencyError if version mismatch
   */
  update(match: Match, expectedVersion: number): Promise<Match>;
  
  /**
   * List matches for a specific player
   * @param playerId - Player identifier
   * @param status - Optional filter by match status
   * @param limit - Max number of results (default 50)
   * @returns Array of matches
   */
  listByPlayer(
    playerId: string,
    status?: Match['status'],
    limit?: number
  ): Promise<Match[]>;
  
  /**
   * Delete a match (admin/cleanup operation)
   * @param matchId - Match to delete
   */
  delete(matchId: string): Promise<void>;
}

/**
 * Error thrown when optimistic concurrency check fails
 */
export class ConcurrencyError extends Error {
  constructor(
    message: string,
    public expectedVersion: number,
    public actualVersion: number
  ) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// ============================================================================
// TURN HISTORY REPOSITORY
// ============================================================================

/**
 * Repository for storing turn history (append-only log)
 * 
 * Implementation notes:
 * - Should be append-only (no updates/deletes)
 * - Should support efficient retrieval by matchId
 * - Primary implementation target: Azure Blob Storage (append blobs)
 */
export interface ITurnHistoryRepository {
  /**
   * Append a turn event to the history
   * @param event - Turn event to record
   */
  append(event: TurnEvent): Promise<void>;
  
  /**
   * Get all turn events for a match
   * @param matchId - Match identifier
   * @returns Array of turn events in chronological order
   */
  getByMatch(matchId: string): Promise<TurnEvent[]>;
  
  /**
   * Get a specific turn event by ID
   * @param eventId - Turn event identifier
   * @returns Turn event or null if not found
   */
  getById(eventId: string): Promise<TurnEvent | null>;
  
  /**
   * Get turn events for a match within a turn number range
   * @param matchId - Match identifier
   * @param fromTurn - Starting turn number (inclusive)
   * @param toTurn - Ending turn number (inclusive)
   * @returns Array of turn events in chronological order
   */
  getByMatchRange(
    matchId: string,
    fromTurn: number,
    toTurn: number
  ): Promise<TurnEvent[]>;
}

// ============================================================================
// IN-MEMORY IMPLEMENTATIONS (for testing)
// ============================================================================

/**
 * In-memory match repository for testing
 */
export class InMemoryMatchRepository implements IMatchRepository {
  private matches = new Map<string, Match>();
  
  async create(match: Match): Promise<Match> {
    if (this.matches.has(match.id)) {
      throw new Error(`Match ${match.id} already exists`);
    }
    
    const stored = { ...match, version: 1 };
    this.matches.set(match.id, stored);
    return stored;
  }
  
  async getById(matchId: string): Promise<Match | null> {
    return this.matches.get(matchId) ?? null;
  }
  
  async update(match: Match, expectedVersion: number): Promise<Match> {
    const existing = this.matches.get(match.id);
    if (!existing) {
      throw new Error(`Match ${match.id} not found`);
    }
    
    if (existing.version !== expectedVersion) {
      throw new ConcurrencyError(
        `Version mismatch for match ${match.id}`,
        expectedVersion,
        existing.version
      );
    }
    
    const updated = { ...match, version: expectedVersion + 1 };
    this.matches.set(match.id, updated);
    return updated;
  }
  
  async listByPlayer(
    playerId: string,
    status?: Match['status'],
    limit: number = 50
  ): Promise<Match[]> {
    const results: Match[] = [];
    
    for (const match of this.matches.values()) {
      const isPlayer = match.players.some(p => p.playerId === playerId);
      const statusMatches = !status || match.status === status;
      
      if (isPlayer && statusMatches) {
        results.push(match);
      }
      
      if (results.length >= limit) break;
    }
    
    return results;
  }
  
  async delete(matchId: string): Promise<void> {
    this.matches.delete(matchId);
  }
  
  // Test helpers
  clear(): void {
    this.matches.clear();
  }
  
  size(): number {
    return this.matches.size;
  }
}

/**
 * In-memory turn history repository for testing
 */
export class InMemoryTurnHistoryRepository implements ITurnHistoryRepository {
  private events = new Map<string, TurnEvent>();
  private byMatch = new Map<string, string[]>(); // matchId -> eventIds
  
  async append(event: TurnEvent): Promise<void> {
    this.events.set(event.id, event);
    
    const matchEvents = this.byMatch.get(event.matchId) ?? [];
    matchEvents.push(event.id);
    this.byMatch.set(event.matchId, matchEvents);
  }
  
  async getByMatch(matchId: string): Promise<TurnEvent[]> {
    const eventIds = this.byMatch.get(matchId) ?? [];
    return eventIds
      .map(id => this.events.get(id)!)
      .sort((a, b) => a.turnNumber - b.turnNumber);
  }
  
  async getById(eventId: string): Promise<TurnEvent | null> {
    return this.events.get(eventId) ?? null;
  }
  
  async getByMatchRange(
    matchId: string,
    fromTurn: number,
    toTurn: number
  ): Promise<TurnEvent[]> {
    const allEvents = await this.getByMatch(matchId);
    return allEvents.filter(
      e => e.turnNumber >= fromTurn && e.turnNumber <= toTurn
    );
  }
  
  // Test helpers
  clear(): void {
    this.events.clear();
    this.byMatch.clear();
  }
  
  size(): number {
    return this.events.size;
  }
}