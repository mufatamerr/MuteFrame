// COMPREHENSIVE list of swear words, profanity, and offensive terms
// Includes all variations, misspellings, and offensive language
const SWEAR_WORDS = new Set([
  // F-word variations (most common)
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fuckin', 'fuckin\'', 'fuckin\'',
  'fuk', 'fuking', 'fuked', 'fuker', 'fukers',
  'f*ck', 'f**k', 'f***', 'f****', 'f*****',
  'fck', 'fcuk', 'phuck', 'phuk',
  'motherfucker', 'motherfuckers', 'motherfucking', 'motherfuckin', 'mothafucker', 'mothafucka',
  'fuck off', 'fuck you', 'fuck me', 'fuck yeah', 'fuck no',
  'fuckhead', 'fuckface', 'fuckwit', 'fucktard',
  
  // S-word variations
  'shit', 'shitting', 'shitted', 'shitter', 'shite', 'shits',
  'sht', 's**t', 'sh*t', 'sh**t',
  'bullshit', 'bullshitting', 'bullshitter',
  'horseshit', 'chickenshit', 'apeshit',
  'shithead', 'shitface', 'shitbag', 'shitstain',
  'holy shit', 'oh shit', 'what the shit',
  
  // B-word variations
  'bitch', 'bitches', 'bitching', 'bitched', 'bitchy', 'bitchin',
  'bch', 'b*tch', 'b**ch', 'biatch', 'biznatch',
  'son of a bitch', 'sob', 'sumbitch',
  'bitchass', 'bitchmade',
  
  // A-word variations
  'ass', 'asses', 'asshole', 'assholes', 'asshat', 'asswipe', 'assclown',
  'arse', 'arses', 'arsehole', 'arseholes',
  'badass', 'smartass', 'dumbass', 'hardass', 'lameass',
  'kickass', 'badassery',
  'a**', 'a**hole', 'a*s',
  
  // D-word variations
  'damn', 'damned', 'dammit', 'damnit', 'dang', 'darn', 'darnit',
  'goddamn', 'goddamned', 'goddamnit', 'goddammit',
  
  // H-word
  'hell', 'hells', 'hellish', 'helluva',
  'bloody hell', 'what the hell', 'the hell',
  
  // C-word variations (very offensive)
  'cunt', 'cunts', 'cunty', 'cunting',
  'c*nt', 'c**t', 'c***',
  
  // P-word variations
  'pussy', 'pussies', 'puss', 'pus',
  'p*ssy', 'p**sy',
  
  // D-word (anatomical)
  'dick', 'dicks', 'dickhead', 'dickface', 'dickwad', 'dickweed',
  'd*ck', 'd**k', 'd***',
  
  // C-word (anatomical)
  'cock', 'cocks', 'cockhead', 'cocksucker', 'cocksuckers',
  'c*ck', 'c**k',
  
  // Other sexual terms
  'slut', 'sluts', 'slutty', 'slutting',
  'whore', 'whores', 'whoring', 'whorehouse',
  'prostitute', 'prostitutes', 'prostitution',
  'hooker', 'hookers',
  'ho', 'hos', 'hoe', 'hoes',
  
  // Insults and derogatory terms
  'bastard', 'bastards', 'bastardy',
  'prick', 'pricks',
  'twat', 'twats',
  'wanker', 'wankers', 'wanking', 'wank',
  'douche', 'douchebag', 'douchebags', 'douchey',
  'jerk', 'jerks', 'jerkoff', 'jerk off',
  'scumbag', 'scumbags',
  'dipshit', 'dipshits',
  'shithead', 'shitheads',
  'fucktard', 'fucktards',
  'retard', 'retarded', 'retards', 'retardation',
  'idiot', 'idiots', 'idiotic', 'idiocy',
  'moron', 'morons', 'moronic',
  'stupid', 'stupidity', 'stupidly',
  'dumb', 'dumbass', 'dumbfuck', 'dumbassery',
  'imbecile', 'imbeciles',
  
  // Racial and ethnic slurs (ALL variations - comprehensive list)
  'nigger', 'niggers', 'nigga', 'niggas', 'niggaz', 'nigguh', 'nigguhs',
  'n*gger', 'n*gga', 'n**ger', 'n**ga', 'n***er', 'n***a',
  'chink', 'chinks', 'chinky',
  'spic', 'spics', 'spick', 'spicks',
  'kike', 'kikes',
  'gook', 'gooks',
  'wetback', 'wetbacks',
  'cracker', 'crackers',
  'honky', 'honkies', 'honkey', 'honkeys',
  'redneck', 'rednecks',
  'coon', 'coons',
  'jap', 'japs',
  'gyp', 'gyps', 'gypsy', 'gypsies',
  'towelhead', 'towelheads',
  'sandnigger', 'sandniggers', 'sandn*gger',
  'towelhead', 'towelheads',
  'raghead', 'ragheads',
  'beaner', 'beaners',
  'wetback', 'wetbacks',
  'spook', 'spooks',
  'zipperhead', 'zipperheads',
  'slant', 'slants', 'slanty',
  'cholo', 'cholos',
  'gook', 'gooks',
  'nip', 'nips',
  'yid', 'yids',
  'heeb', 'heebs',
  'kraut', 'krauts',
  'mick', 'micks',
  'paddy', 'paddies',
  'wop', 'wops',
  'dago', 'dagos',
  'guinea', 'guineas',
  'polack', 'polacks',
  'bohunk', 'bohunks',
  'hymie', 'hymies',
  'kyke', 'kykes',
  
  // Other offensive terms
  'fag', 'fags', 'faggot', 'faggots', 'faggy', 'faggotry',
  'f*g', 'f**got', 'f***ot',
  'dyke', 'dykes',
  'tranny', 'trannies', 'trannys',
  'shemale', 'shemales',
  'trap', 'traps',
  
  // Body shaming and ableist terms
  'fatass', 'fatasses',
  'lardass', 'lardasses',
  'cripple', 'cripples', 'crippled',
  'gimp', 'gimps',
  'spaz', 'spazz', 'spazzes',
  
  // Violence and threats
  'kill', 'killing', 'killed', 'killer', 'killers',
  'murder', 'murdering', 'murdered', 'murderer', 'murderers',
  'die', 'dying', 'death', 'dead',
  'suicide', 'suicidal',
  'rape', 'raping', 'raped', 'rapist', 'rapists',
  'molest', 'molesting', 'molested', 'molester', 'molesters',
  
  // Additional profanity
  'piss', 'pissing', 'pissed', 'pisser', 'pissers',
  'crap', 'crappy', 'craps',
  'screw', 'screwed', 'screwing', 'screw you',
  'bloody', 'bloody hell',
  'bugger', 'buggered', 'buggering', 'buggers',
  'sod', 'sods', 'sodding',
  'bollocks', 'bollock',
  'tosser', 'tossers',
  'git', 'gits',
  'pillock', 'pillocks',
  'plonker', 'plonkers',
  'muppet', 'muppets',
  'numpty', 'numpties',
  'berk', 'berks',
  'knob', 'knobs', 'knobhead', 'knobheads',
  'bellend', 'bellends',
  'tosser', 'tossers',
  'wanker', 'wankers',
  
  // Phrases and expressions
  'son of a bitch', 'sob',
  'what the fuck', 'wtf',
  'what the hell', 'wth',
  'oh my god', 'omg',
  'for fuck\'s sake', 'ffs',
  'for fucks sake',
  'fuck sake',
  'fuck\'s sake',
  'fuck this', 'fuck that',
  'fuck it', 'fuck off',
  'fuck you', 'fuck me',
  'fuck yeah', 'fuck no',
  'fuck up', 'fucked up',
  'fuck around', 'fucking around',
  'fuck with', 'fucking with',
  'fuck all',
  'piece of shit', 'pos',
  'piece of crap',
  'full of shit',
  'eat shit',
  'shit happens',
  'no shit',
  'holy shit',
  'oh shit',
  'what the shit',
  'shit out of luck', 'sol',
  'up shit creek',
  'in deep shit',
  'shit the bed',
  'shit bricks',
  'shit storm',
  'shit show',
  'clusterfuck', 'clusterfucks',
  'fuckfest', 'fuckfests',
  'shitshow', 'shitshows',
  'dumpster fire',
  
  // Misspellings and variations (common in transcriptions)
  'fuk', 'fuking', 'fuked', 'fuker',
  'shyt', 'shytty',
  'bich', 'biches',
  'as', 'as hole', 'as hole',
  'dik', 'diks',
  'kok', 'koks',
  'pusy', 'pusies',
  'cnt', 'cnts',
  'slutty', 'slutting',
  'hore', 'hores',
  
  // Leetspeak and number substitutions
  'fuck', 'fuk', 'phuck', 'phuk',
  'shit', 'shyt', 'sh1t', 'sh!t',
  'ass', 'a$$', 'a55',
  'bitch', 'b1tch', 'b!tch',
  'dick', 'd1ck', 'd!ck',
  'cock', 'c0ck', 'c0ck',
  'pussy', 'puss1', 'puss!',
  'cunt', 'c0nt', 'c!nt',
  
  // Additional offensive terms
  'scum', 'scumbag', 'scumbags',
  'trash', 'trashy',
  'garbage', 'garbagey',
  'loser', 'losers',
  'pathetic', 'pathetically',
  'worthless', 'worthlessness',
  'useless', 'uselessness',
])

// Function to normalize word for matching (handles variations, misspellings, leetspeak)
function normalizeWord(word) {
  // Convert to lowercase and remove all punctuation
  let normalized = word.toLowerCase().replace(/[^\w\s]/g, '').trim()
  
  // Replace common number/character substitutions (leetspeak)
  normalized = normalized
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\*/g, '')
  
  return normalized
}

// Common words that should NEVER be detected as swear words
const COMMON_WORDS_WHITELIST = new Set([
  'and', 'the', 'a', 'an', 'or', 'but', 'if', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
  'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
  'where', 'when', 'why', 'how', 'all', 'each', 'every', 'some', 'any',
  'more', 'most', 'many', 'much', 'few', 'little', 'other', 'another',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'you', 'your', 'yours', 'he', 'she', 'it', 'we', 'they', 'them', 'their',
  'i', 'me', 'my', 'mine', 'us', 'our', 'ours', 'his', 'her', 'hers', 'its',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto',
  'up', 'down', 'out', 'off', 'over', 'under', 'above', 'below', 'between',
  'about', 'across', 'through', 'during', 'before', 'after', 'while',
  'so', 'than', 'as', 'like', 'such', 'just', 'only', 'also', 'even', 'still',
  'very', 'too', 'quite', 'rather', 'really', 'well', 'now', 'then', 'here', 'there',
  'yes', 'no', 'not', 'never', 'always', 'often', 'sometimes', 'usually'
])

// Function to check if a word is a swear word (PRECISE detection)
function isSwearWord(word) {
  // Normalize the word
  const cleanWord = normalizeWord(word)
  
  // Skip very short words (1-2 characters) to avoid false positives like "i", "a", "you"
  if (cleanWord.length < 3) {
    return false
  }
  
  // Check whitelist first - common words should never be detected
  if (COMMON_WORDS_WHITELIST.has(cleanWord)) {
    return false
  }
  
  // Check exact match first (most reliable)
  if (SWEAR_WORDS.has(cleanWord)) {
    return true
  }
  
  // Check if word is a known variation (exact match in swear words set)
  // This catches things like "fucking" if it's in the list, but not "hand" because "and" is in it
  for (const swear of SWEAR_WORDS) {
    // Only check swears that are at least 3 characters
    if (swear.length >= 3) {
      // Escape special regex characters in the swear word
      const escapedSwear = swear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Check if the word contains the swear word as a whole word (not substring)
      // This catches "fucking" containing "fuck", but not "hand" containing "and"
      const wordBoundaryRegex = new RegExp(`\\b${escapedSwear}\\b`, 'i')
      if (wordBoundaryRegex.test(cleanWord)) {
        return true
      }
    }
  }
  
  // Also check for common patterns (f*ck, sh*t, etc.) - these are specific patterns
  const patterns = [
    /f+u+c+k+/i,
    /s+h+i+t+/i,
    /b+i+t+c+h+/i,
    /a+s+s+/i,
    /d+i+c+k+/i,
    /c+o+c+k+/i,
    /p+u+s+s+y+/i,
    /c+u+n+t+/i,
    /n+i+g+[ae]r+/i,
  ]
  
  for (const pattern of patterns) {
    if (pattern.test(cleanWord)) {
      return true
    }
  }
  
  return false
}

export function detectSwearWords(transcription) {
  const swearWordTimestamps = []
  
  // Track which words we've already processed to avoid duplicates
  const processedIndices = new Set()
  
  for (let i = 0; i < transcription.length; i++) {
    const item = transcription[i]
    const word = item.word || ''
    
    // Skip if already processed
    if (processedIndices.has(i)) {
      continue
    }
    
    // Check individual words first (most precise)
    if (isSwearWord(word)) {
      swearWordTimestamps.push({
        start: item.start,
        end: item.end,
        word: word
      })
      processedIndices.add(i)
      continue
    }
    
    // Check for multi-word phrases (like "son of a bitch", "what the fuck")
    // Only match known phrases, prioritize individual word detection
    let matched = false
    
    // Known multi-word swear phrases (exact matches only)
    const knownPhrases = new Set([
      'son of a bitch', 'what the fuck', 'what the hell', 'holy shit',
      'oh shit', 'oh my god', 'for fuck sake', 'fuck sake', 'fuck off',
      'fuck you', 'fuck me', 'fuck yeah', 'fuck no', 'fuck this', 'fuck that',
      'piece of shit', 'full of shit', 'eat shit', 'no shit', 'what the shit',
      'bullshit', 'horseshit', 'chickenshit', 'motherfucker', 'motherfucking'
    ])
    
    // Check 3-word phrases (max 3 words) - only for known phrases
    if (i >= 2 && !matched) {
      const phrase3 = [
        transcription[i - 2]?.word || '',
        transcription[i - 1]?.word || '',
        word
      ].join(' ').toLowerCase().trim()
      
      // Only match if it's a known phrase (exact match)
      if (knownPhrases.has(phrase3)) {
        swearWordTimestamps.push({
          start: transcription[i - 2].start,
          end: item.end,
          word: phrase3
        })
        processedIndices.add(i - 2)
        processedIndices.add(i - 1)
        processedIndices.add(i)
        matched = true
      }
    }
    
    // Check 2-word phrases (max 2 words) - only for known phrases
    if (i >= 1 && !matched) {
      const phrase2 = [
        transcription[i - 1]?.word || '',
        word
      ].join(' ').toLowerCase().trim()
      
      // Only match if it's a known phrase (exact match)
      if (knownPhrases.has(phrase2)) {
        swearWordTimestamps.push({
          start: transcription[i - 1].start,
          end: item.end,
          word: phrase2
        })
        processedIndices.add(i - 1)
        processedIndices.add(i)
        matched = true
      }
    }
  }
  
  // Remove duplicates and merge ONLY truly overlapping timestamps
  // Don't merge if intervals are more than 0.2 seconds apart
  const merged = []
  swearWordTimestamps.sort((a, b) => a.start - b.start)
  
  console.log(`   Detected ${swearWordTimestamps.length} swear word intervals before merging:`)
  swearWordTimestamps.forEach((item, idx) => {
    console.log(`     ${idx + 1}. "${item.word}" [${item.start.toFixed(2)}s - ${item.end.toFixed(2)}s] (${(item.end - item.start).toFixed(2)}s)`)
  })
  
  // First, remove exact duplicates (same word, same time range)
  const unique = []
  for (const current of swearWordTimestamps) {
    const isDuplicate = unique.some(existing => 
      existing.start === current.start && 
      existing.end === current.end && 
      existing.word === current.word
    )
    if (!isDuplicate) {
      unique.push({ ...current })
    }
  }
  
  // Don't merge intervals - keep each swear word separate
  // Only merge if intervals truly overlap (not just adjacent)
  const MAX_OVERLAP_TOLERANCE = 0.1 // Only merge if intervals overlap by at least 0.1s
  
  for (const current of unique) {
    const last = merged[merged.length - 1]
    // Only merge if intervals actually overlap (not just adjacent)
    // current.start must be BEFORE last.end (overlap), not just close
    if (last && current.start < last.end - MAX_OVERLAP_TOLERANCE) {
      // Intervals truly overlap - merge them
      const overlap = last.end - current.start
      console.log(`   Merging overlapping intervals: "${last.word}" [${last.start.toFixed(2)}s-${last.end.toFixed(2)}s] + "${current.word}" [${current.start.toFixed(2)}s-${current.end.toFixed(2)}s] (overlap: ${overlap.toFixed(2)}s)`)
      last.end = Math.max(last.end, current.end)
      // Only add word if it's different (avoid duplicate words)
      if (current.word !== last.word && !last.word.includes(current.word)) {
        last.word = last.word + ' ' + current.word
      }
    } else {
      // Keep intervals separate - each swear word gets its own beep
      merged.push({ ...current })
    }
  }
  
  console.log(`   After merging: ${merged.length} intervals`)
  merged.forEach((item, idx) => {
    console.log(`     ${idx + 1}. "${item.word}" [${item.start.toFixed(2)}s - ${item.end.toFixed(2)}s] (${(item.end - item.start).toFixed(2)}s)`)
  })
  
  return merged
}

