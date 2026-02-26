/**
 * Person Comparison Functions
 * 
 * Functions for comparing actors and directors between two users.
 * Returns detailed information about overlapping favorite persons.
 */

import type { PersonProfiles } from './types';

export interface PersonOverlapDetail {
  name: string;
  userScore: number;
  comparedScore: number;
  average: number;
}

export interface PersonComparisonResult {
  actors: {
    mutual: PersonOverlapDetail[];      // Actors both users like
    onlyInUser: PersonOverlapDetail[];  // Actors only current user likes
    onlyInCompared: PersonOverlapDetail[]; // Actors only compared user likes
    jaccardIndex: number;               // 0-1, 1 = identical
  };
  directors: {
    mutual: PersonOverlapDetail[];
    onlyInUser: PersonOverlapDetail[];
    onlyInCompared: PersonOverlapDetail[];
    jaccardIndex: number;
  };
  overallMatch: number; // Average between actors and directors Jaccard
}

/**
 * Compare person profiles (actors and directors) between two users
 * Returns detailed breakdown of overlapping and unique preferences
 */
export function comparePersonProfiles(
  userProfiles: PersonProfiles,
  comparedProfiles: PersonProfiles
): PersonComparisonResult {
  const actorsResult = comparePersonSet(
    userProfiles.actors,
    comparedProfiles.actors
  );

  const directorsResult = comparePersonSet(
    userProfiles.directors,
    comparedProfiles.directors
  );

  return {
    actors: actorsResult,
    directors: directorsResult,
    overallMatch: (actorsResult.jaccardIndex + directorsResult.jaccardIndex) / 2,
  };
}

/**
 * Compare a single person set (actors or directors)
 * Returns mutual, unique to each user, and Jaccard index
 */
function comparePersonSet(
  personSetA: Record<string, number>,
  personSetB: Record<string, number>
): {
  mutual: PersonOverlapDetail[];
  onlyInUser: PersonOverlapDetail[];
  onlyInCompared: PersonOverlapDetail[];
  jaccardIndex: number;
} {
  const entriesA = Object.entries(personSetA).filter(([, score]) => score > 0);
  const entriesB = Object.entries(personSetB).filter(([, score]) => score > 0);

  const setA = new Set(entriesA.map(([name]) => name));
  const setB = new Set(entriesB.map(([name]) => name));

  // Handle empty profiles
  if (setA.size === 0 && setB.size === 0) {
    return {
      mutual: [],
      onlyInUser: [],
      onlyInCompared: [],
      jaccardIndex: 1, // Both empty = perfect match
    };
  }

  // Maps for quick lookup
  const mapA = new Map(entriesA);
  const mapB = new Map(entriesB);

  // Find mutual persons
  const mutual: PersonOverlapDetail[] = [];
  for (const name of Array.from(setA)) {
    if (setB.has(name)) {
      mutual.push({
        name,
        userScore: mapA.get(name) || 0,
        comparedScore: mapB.get(name) || 0,
        average: ((mapA.get(name) || 0) + (mapB.get(name) || 0)) / 2,
      });
    }
  }

  // Find unique to user A
  const onlyInUser: PersonOverlapDetail[] = [];
  for (const name of Array.from(setA)) {
    if (!setB.has(name)) {
      onlyInUser.push({
        name,
        userScore: mapA.get(name) || 0,
        comparedScore: 0,
        average: (mapA.get(name) || 0) / 2,
      });
    }
  }

  // Find unique to user B
  const onlyInCompared: PersonOverlapDetail[] = [];
  for (const name of Array.from(setB)) {
    if (!setA.has(name)) {
      onlyInCompared.push({
        name,
        userScore: 0,
        comparedScore: mapB.get(name) || 0,
        average: (mapB.get(name) || 0) / 2,
      });
    }
  }

  // Sort by score (highest first)
  mutual.sort((a, b) => b.average - a.average);
  onlyInUser.sort((a, b) => b.userScore - a.userScore);
  onlyInCompared.sort((a, b) => b.comparedScore - a.comparedScore);

  // Calculate Jaccard index
  const intersectionSize = mutual.length;
  const unionSize = setA.size + setB.size - intersectionSize;
  const jaccardIndex = unionSize === 0 ? 0 : intersectionSize / unionSize;

  return {
    mutual,
    onlyInUser,
    onlyInCompared,
    jaccardIndex,
  };
}
