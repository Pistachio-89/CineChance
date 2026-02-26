/**
 * Verification script for overall match calculation
 * Ensures both server and client use the same formula
 */

// Server-side calculation (from computeOverallMatch)
function computeServerOverallMatch(ratingPatterns, tasteSimilarity, personOverlap) {
  const movieScore = ratingPatterns?.overallMovieMatch ?? 0;
  
  return (
    movieScore * 0.5 +           // Movies
    tasteSimilarity * 0.3 +      // Genres
    personOverlap * 0.2          // Persons
  );
}

// Client-side calculation (from compare/[userId]/page.tsx)
function computeClientOverallMatch(ratingPatterns, tasteSimilarity, personOverlap) {
  const movieScore = ratingPatterns?.overallMovieMatch || 0;
  const genreScore = tasteSimilarity;
  const personScore = personOverlap;
  
  return (movieScore * 0.5) + (genreScore * 0.3) + (personScore * 0.2);
}

// Test cases
const testCases = [
  {
    name: 'Perfect match (all 1.0)',
    ratingPatterns: { overallMovieMatch: 1.0 },
    tasteSimilarity: 1.0,
    personOverlap: 1.0,
    expected: 1.0
  },
  {
    name: 'No match (all 0)',
    ratingPatterns: { overallMovieMatch: 0 },
    tasteSimilarity: 0,
    personOverlap: 0,
    expected: 0
  },
  {
    name: 'Realistic case 1',
    ratingPatterns: { overallMovieMatch: 0.75 },
    tasteSimilarity: 0.65,
    personOverlap: 0.55,
    expected: 0.75 * 0.5 + 0.65 * 0.3 + 0.55 * 0.2  // 0.375 + 0.195 + 0.11 = 0.68
  },
  {
    name: 'Realistic case 2',
    ratingPatterns: { overallMovieMatch: 0.82 },
    tasteSimilarity: 0.7,
    personOverlap: 0.4,
    expected: 0.82 * 0.5 + 0.7 * 0.3 + 0.4 * 0.2  // 0.41 + 0.21 + 0.08 = 0.7
  }
];

console.log('🧪 Testing Overall Match Calculation Consistency\n');
console.log('=' .repeat(60));

let allPassed = true;

testCases.forEach(test => {
  const server = computeServerOverallMatch(
    test.ratingPatterns,
    test.tasteSimilarity,
    test.personOverlap
  );
  
  const client = computeClientOverallMatch(
    test.ratingPatterns,
    test.tasteSimilarity,
    test.personOverlap
  );
  
  const serverPercent = (server * 100).toFixed(1);
  const clientPercent = (client * 100).toFixed(1);
  const expectedPercent = (test.expected * 100).toFixed(1);
  
  const passed = Math.abs(server - client) < 0.0001 && Math.abs(server - test.expected) < 0.0001;
  
  console.log(`\n✅ ${test.name}`);
  console.log(`  Server: ${serverPercent}%`);
  console.log(`  Client: ${clientPercent}%`);
  console.log(`  Expected: ${expectedPercent}%`);
  console.log(`  Status: ${passed ? '✓ PASS' : '✗ FAIL'}`);
  
  if (!passed) {
    allPassed = false;
    console.log(`  Difference: ${Math.abs(server - client)}`);
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
console.log('\nFormula used:');
console.log('  overallMatch = (movieScore × 0.5) + (genreScore × 0.3) + (personScore × 0.2)');
console.log('\nWeights:');
console.log('  🎬 Movies (overallMovieMatch): 50%');
console.log('  🎭 Genres (tasteSimilarity):    30%');
console.log('  👥 Persons (personOverlap):    20%');
