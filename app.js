(function () {
  "use strict";

  const MAX_CONSECUTIVE_PLAY = 2;
  const MAX_CONSECUTIVE_REST = 2;
  const MAX_SCHEDULE_ATTEMPTS = 200;

  // ── DOM refs ──────────────────────────────────────────────
  const $stepSetup    = document.getElementById("step-setup");
  const $stepNames    = document.getElementById("step-names");
  const $stepCardpick = document.getElementById("step-cardpick");
  const $stepLeague   = document.getElementById("step-league");
  const $stepSemis    = document.getElementById("step-semis");
  const $stepFinals   = document.getElementById("step-finals");
  const $stepSummary  = document.getElementById("step-summary");
  const allSteps = [$stepSetup, $stepNames, $stepCardpick, $stepLeague, $stepSemis, $stepFinals, $stepSummary];

  const $numPlayers = document.getElementById("numPlayers");
  const $numCourts  = document.getElementById("numCourts");
  const $setupError = document.getElementById("setup-error");
  const $gameModeGroup = document.getElementById("gameModeGroup");
  const $gptGroup      = document.getElementById("gptGroup");
  const $numGamesPerTeam = document.getElementById("numGamesPerTeam");
  const $gptHint         = document.getElementById("gptHint");

  const $nameFields = document.getElementById("nameFields");
  const $namesError = document.getElementById("names-error");
  const $teamModeGroup  = document.getElementById("teamModeGroup");
  const $fixedTeamsArea = document.getElementById("fixedTeamsArea");
  const $fixedPairsDone = document.getElementById("fixedPairsDone");
  const $fixedChipsPool = document.getElementById("fixedChipsPool");
  const $fixedTeamsHint = document.getElementById("fixedTeamsHint");

  const $pickBanner = document.getElementById("pickBanner");
  const $pickGrid   = document.getElementById("pickGrid");
  const $pickLog    = document.getElementById("pickLog");
  const $pickDone   = document.getElementById("pickDone");
  const btnStartLeague = document.getElementById("btnStartLeague");
  const btnBackToNames = document.getElementById("btnBackToNames");

  const $gamesInfo       = document.getElementById("gamesInfo");
  const $teamsList       = document.getElementById("teamsList");
  const $schedHead       = document.getElementById("scheduleHead");
  const $schedBody       = document.getElementById("scheduleBody");
  const $leaderboardBody = document.getElementById("leaderboardBody");
  const $leagueProgress  = document.getElementById("league-progress");

  const $semisInfo    = document.getElementById("semisInfo");
  const $semisMatches = document.getElementById("semisMatches");
  const $finalsMatch  = document.getElementById("finalsMatch");
  const $finalStandings = document.getElementById("finalStandings");

  const $courtCost  = document.getElementById("courtCost");
  const $shuttleCost = document.getElementById("shuttleCost");
  const $costResultsSection = document.getElementById("costResultsSection");
  const $costSummaryInfo = document.getElementById("costSummaryInfo");
  const $costBody  = document.getElementById("costBody");
  const $costTotal = document.getElementById("costTotal");

  const btnNext           = document.getElementById("btnNext");
  const btnBack           = document.getElementById("btnBack");
  const btnGenerate       = document.getElementById("btnGenerate");
  const btnLeagueRestart  = document.getElementById("btnLeagueRestart");
  const btnLeagueReRandom = document.getElementById("btnLeagueReRandomize");
  const btnToSemis        = document.getElementById("btnToSemis");
  const btnBackToLeague   = document.getElementById("btnBackToLeague");
  const btnToFinals       = document.getElementById("btnToFinals");
  const btnBackToSemis    = document.getElementById("btnBackToSemis");
  const btnToSummary      = document.getElementById("btnToSummary");
  const btnCalcCost       = document.getElementById("btnCalcCost");
  const btnSummaryRestart = document.getElementById("btnSummaryRestart");
  const btnPrint          = document.getElementById("btnPrint");

  // ── Tournament state ──────────────────────────────────────
  let currentPlayers = [];
  let currentCourts  = 2;
  let gameMode = "specify";
  let teamMode = "random";
  let teams = [];
  let schedule = [];
  let gamesPerTeam = 3;
  let matchResults = [];
  let matchScores = [];
  let semiTeams = [];
  let semiWinners = [null, null];
  let finalWinner = null;
  let finalLoser  = null;
  let currentStep = "setup";

  let cardPickState = null;

  const STORAGE_KEY = "matchpoint_tournament";

  // ── Persistence ─────────────────────────────────────────

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentPlayers, currentCourts, gameMode, teamMode, teams, schedule,
        gamesPerTeam, matchResults, matchScores, semiTeams, semiWinners,
        finalWinner, finalLoser, currentStep, cardPickState
      }));
    } catch (_) {}
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s.currentPlayers || !s.currentPlayers.length) return false;
      if (s.currentStep === "cardpick" && !s.cardPickState) return false;
      if (s.currentStep !== "cardpick" && (!s.teams || !s.teams.length || !s.schedule)) return false;

      currentPlayers = s.currentPlayers;
      currentCourts  = s.currentCourts;
      gameMode       = s.gameMode || "specify";
      teamMode       = s.teamMode || "random";
      teams          = s.teams || [];
      schedule       = s.schedule || [];
      gamesPerTeam   = s.gamesPerTeam;
      matchResults   = s.matchResults || [];
      matchScores    = s.matchScores || (schedule.length ? schedule.map(r => r.map(() => null)) : []);
      semiTeams      = s.semiTeams || [];
      semiWinners    = s.semiWinners || [null, null];
      finalWinner    = s.finalWinner;
      finalLoser     = s.finalLoser;
      currentStep    = s.currentStep || "league";
      cardPickState  = s.cardPickState || null;

      return true;
    } catch (_) {
      return false;
    }
  }

  function restoreView() {
    if (currentStep === "cardpick" && cardPickState) {
      restoreCardPick();
      allSteps.forEach(st => st.hidden = true);
      $stepCardpick.hidden = false;
      return;
    }

    const modeLabel = gameMode === "roundrobin" ? "Full Round-Robin" : `${gamesPerTeam} games/team`;
    $gamesInfo.textContent = `${teams.length} teams, ${currentCourts} court(s), ${modeLabel}`;
    renderTeams();
    renderScheduleWithButtons();
    renderLeaderboard();
    updateLeagueProgress();

    const stepEl = { setup: $stepSetup, names: $stepNames, cardpick: $stepCardpick,
                     league: $stepLeague, semis: $stepSemis, finals: $stepFinals, summary: $stepSummary };

    if (currentStep === "semis" || currentStep === "finals" || currentStep === "summary") {
      renderSemis(true);
    }
    if (currentStep === "finals" || currentStep === "summary") {
      renderFinals(true);
    }
    if (currentStep === "summary") {
      renderSummary();
    }

    allSteps.forEach(st => st.hidden = true);
    (stepEl[currentStep] || $stepLeague).hidden = false;
  }

  // ── Utility ───────────────────────────────────────────────

  function cryptoRandInt(max) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  function fisherYatesShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = cryptoRandInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const stepNameMap = new Map([
    [$stepSetup, "setup"], [$stepNames, "names"], [$stepCardpick, "cardpick"],
    [$stepLeague, "league"], [$stepSemis, "semis"], [$stepFinals, "finals"], [$stepSummary, "summary"]
  ]);

  function showStep(step) {
    allSteps.forEach(s => s.hidden = true);
    step.hidden = false;
    currentStep = stepNameMap.get(step) || "setup";
    step.scrollIntoView({ behavior: "smooth", block: "start" });
    if (currentPlayers.length) saveState();
  }

  function showError(el, msg) { el.textContent = msg; el.hidden = false; }
  function clearError(el)     { el.textContent = ""; el.hidden = true; }

  function teamSpan(teamIdx) {
    const t = teams[teamIdx];
    return `<span class="team-color-${teamIdx % 24}" style="padding:2px 6px;border-radius:4px;">${t.label}</span>`;
  }

  function getSelectedGameMode() {
    const checked = $gameModeGroup.querySelector('input[name="gameMode"]:checked');
    return checked ? checked.value : "specify";
  }

  function getSelectedTeamMode() {
    const checked = $teamModeGroup.querySelector('input[name="teamMode"]:checked');
    return checked ? checked.value : "random";
  }

  function updateGptVisibility() {
    const mode = getSelectedGameMode();
    $gptGroup.style.display = (mode === "specify") ? "" : "none";
  }

  function updateTeamModeVisibility() {
    const mode = getSelectedTeamMode();
    $fixedTeamsArea.hidden = (mode === "random");
    if (!$fixedTeamsArea.hidden) {
      pendingPick = null;
      rebuildFixedUI();
    }
  }

  // ── Step 1 validation ────────────────────────────────────

  function validateSetup() {
    const n = parseInt($numPlayers.value, 10);
    const c = parseInt($numCourts.value, 10);
    if (isNaN(n) || n < 6 || n > 24) return "Players must be between 6 and 24.";
    if (n % 2 !== 0) return "Number of players must be even (teams are pairs).";
    if (isNaN(c) || c < 1 || c > 4) return "Courts must be between 1 and 4.";
    const numTeams = n / 2;
    if (numTeams < c * 3) {
      return `Need at least ${c * 3} teams (${c * 3 * 2} players) for ${c} court(s) to satisfy rest constraints.`;
    }

    const mode = getSelectedGameMode();
    if (mode === "specify") {
      const g = parseInt($numGamesPerTeam.value, 10);
      if (isNaN(g) || g < 1 || g > numTeams - 1) {
        return `Games per team must be between 1 and ${numTeams - 1}.`;
      }
      if ((numTeams * g) % 2 !== 0) {
        return `${numTeams} teams \u00d7 ${g} games = ${numTeams * g} (odd). Either change players or games to make the product even.`;
      }
    }
    return null;
  }

  function buildNameFields(count) {
    $nameFields.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "form-group";
      div.innerHTML = `<label for="player-${i}">Player ${i + 1}</label>
        <input type="text" id="player-${i}" placeholder="Player ${i + 1}" autocomplete="off" />`;
      $nameFields.appendChild(div);
    }
  }

  function gatherNames() {
    const inputs = $nameFields.querySelectorAll("input");
    const names = [];
    const seen = new Set();
    for (const inp of inputs) {
      const name = inp.value.trim();
      if (!name) return { error: "All player names are required." };
      if (seen.has(name.toLowerCase())) return { error: `Duplicate name: "${name}".` };
      seen.add(name.toLowerCase());
      names.push(name);
    }
    return { names };
  }

  // ── Fixed Teams Builder (click-to-pair) ─────────────────────

  let fixedPairs = [];
  let pendingPick = null;

  function rebuildFixedUI() {
    const names = gatherNames().names || [];
    const assigned = new Set(fixedPairs.flat());

    $fixedPairsDone.innerHTML = "";
    fixedPairs.forEach(([a, b], i) => {
      const tag = document.createElement("div");
      tag.className = "fixed-pair-tag";
      tag.innerHTML = `<span>${a} &amp; ${b}</span><button class="fixed-pair-remove" data-pair="${i}">&times;</button>`;
      $fixedPairsDone.appendChild(tag);
    });

    $fixedChipsPool.innerHTML = "";
    names.forEach(name => {
      if (assigned.has(name)) return;
      const chip = document.createElement("button");
      chip.className = "player-chip" + (pendingPick === name ? " selected" : "");
      chip.textContent = name;
      chip.dataset.name = name;
      $fixedChipsPool.appendChild(chip);
    });

    const remaining = names.length - assigned.size;
    const mode = getSelectedTeamMode();
    if (mode === "fixed") {
      $fixedTeamsHint.textContent = remaining > 0
        ? `${assigned.size} of ${names.length} assigned. Tap two players to pair them.`
        : `All ${names.length} players assigned!`;
    } else {
      $fixedTeamsHint.textContent = `${assigned.size} fixed, ${remaining} will go to card pick.`;
    }
  }

  function handleChipClick(name) {
    if (pendingPick === null) {
      pendingPick = name;
      rebuildFixedUI();
    } else if (pendingPick === name) {
      pendingPick = null;
      rebuildFixedUI();
    } else {
      fixedPairs.push([pendingPick, name]);
      pendingPick = null;
      rebuildFixedUI();
    }
  }

  function removeFixedPair(idx) {
    fixedPairs.splice(idx, 1);
    pendingPick = null;
    rebuildFixedUI();
  }

  function gatherFixedTeams() {
    return { fixed: fixedPairs.slice(), assigned: new Set(fixedPairs.flat()), errors: [] };
  }

  // ── Team Generation ───────────────────────────────────────

  function formTeams(players) {
    const shuffled = fisherYatesShuffle(players);
    const t = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      t.push({ id: t.length, players: [shuffled[i], shuffled[i + 1]], label: `Team ${t.length + 1}` });
    }
    return t;
  }

  function buildTeamsFromPairs(pairs) {
    return pairs.map((p, i) => ({ id: i, players: [p[0], p[1]], label: `Team ${i + 1}` }));
  }

  // ── Card Pick Ceremony ────────────────────────────────────

  function initCardPick(playersToRandomize, fixedPairs) {
    const numRandomTeams = playersToRandomize.length / 2;
    const startTeamNum = fixedPairs.length + 1;

    const cardValues = [];
    for (let t = 0; t < numRandomTeams; t++) {
      cardValues.push(startTeamNum + t);
      cardValues.push(startTeamNum + t);
    }
    const shuffledCards = fisherYatesShuffle(cardValues);
    const shuffledPlayers = fisherYatesShuffle(playersToRandomize);

    cardPickState = {
      fixedPairs,
      playerQueue: shuffledPlayers,
      cardValues: shuffledCards,
      revealed: shuffledCards.map(() => false),
      picks: {},
      currentPickIndex: 0,
      teamAssignments: {}
    };

    renderCardPick();
    saveState();
  }

  function renderCardPick() {
    const s = cardPickState;
    if (!s) return;

    const allDone = s.currentPickIndex >= s.playerQueue.length;

    if (allDone) {
      $pickBanner.innerHTML = `<span class="pick-complete">All players have picked!</span>`;
      $pickDone.hidden = false;
    } else {
      const playerName = s.playerQueue[s.currentPickIndex];
      $pickBanner.innerHTML = `<span class="pick-player-name">${playerName}</span>, pick a card!`;
      $pickDone.hidden = true;
    }

    $pickGrid.innerHTML = "";
    s.cardValues.forEach((val, i) => {
      const card = document.createElement("div");
      card.className = "pick-card" + (s.revealed[i] ? " flipped" : "");
      card.dataset.index = i;

      if (s.revealed[i]) {
        const teamIdx = val - 1;
        card.innerHTML = `<div class="pick-card-face pick-card-back">?</div>
          <div class="pick-card-face pick-card-front team-color-${teamIdx % 24}">T${val}</div>`;
      } else {
        card.innerHTML = `<div class="pick-card-face pick-card-back">?</div>`;
      }

      if (!s.revealed[i] && !allDone) {
        card.addEventListener("click", () => handleCardClick(i));
      }
      $pickGrid.appendChild(card);
    });

    renderPickLog();
  }

  function handleCardClick(cardIndex) {
    const s = cardPickState;
    if (!s || s.revealed[cardIndex]) return;
    if (s.currentPickIndex >= s.playerQueue.length) return;

    const playerName = s.playerQueue[s.currentPickIndex];
    const teamNum = s.cardValues[cardIndex];

    s.revealed[cardIndex] = true;
    s.picks[playerName] = teamNum;

    if (!s.teamAssignments[teamNum]) {
      s.teamAssignments[teamNum] = [playerName];
    } else {
      s.teamAssignments[teamNum].push(playerName);
    }

    s.currentPickIndex++;

    renderCardPick();
    saveState();
  }

  function renderPickLog() {
    const s = cardPickState;
    $pickLog.innerHTML = "";

    const entries = [];
    for (let i = 0; i < s.currentPickIndex; i++) {
      const player = s.playerQueue[i];
      const teamNum = s.picks[player];
      const teamComplete = s.teamAssignments[teamNum] && s.teamAssignments[teamNum].length === 2;

      let html = `<span class="pick-log-player">${player}</span> picked <span class="team-color-${(teamNum - 1) % 24}" style="padding:1px 6px;border-radius:4px;">Team ${teamNum}</span>`;
      if (teamComplete) {
        const partner = s.teamAssignments[teamNum].find(p => p !== player);
        if (s.teamAssignments[teamNum][1] === player) {
          html += ` &mdash; Team ${teamNum} complete! (${s.teamAssignments[teamNum][0]} &amp; ${player})`;
        }
      }
      entries.push(html);
    }

    entries.reverse().forEach(html => {
      const div = document.createElement("div");
      div.className = "pick-log-entry";
      div.innerHTML = html;
      $pickLog.appendChild(div);
    });
  }

  function restoreCardPick() {
    renderCardPick();
  }

  function finalizeTeamsFromCardPick() {
    const s = cardPickState;
    const allPairs = [...s.fixedPairs];

    const teamNums = Object.keys(s.teamAssignments).map(Number).sort((a, b) => a - b);
    teamNums.forEach(num => {
      const pair = s.teamAssignments[num];
      if (pair && pair.length === 2) {
        allPairs.push([pair[0], pair[1]]);
      }
    });

    teams = buildTeamsFromPairs(allPairs);
    cardPickState = null;

    startLeaguePhase();
  }

  // ── Matchup Generation (Phase 1) ──────────────────────────

  function generateAllPairs(n) {
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.push([i, j]);
      }
    }
    return pairs;
  }

  function circleMethodRounds(n) {
    const isOdd = n % 2 !== 0;
    const effective = isOdd ? n + 1 : n;
    const BYE = isOdd ? n : -1;
    const numRounds = effective - 1;
    const rounds = [];
    const slots = [];
    for (let i = 1; i < effective; i++) slots.push(i);

    for (let r = 0; r < numRounds; r++) {
      const roundPairs = [];
      const top = 0;
      const bottom = slots[slots.length - 1];
      if (top !== BYE && bottom !== BYE) roundPairs.push([top, bottom]);
      for (let i = 0; i < (effective / 2) - 1; i++) {
        const a = slots[i];
        const b = slots[slots.length - 2 - i];
        if (a !== BYE && b !== BYE) roundPairs.push([a, b]);
      }
      rounds.push(roundPairs);
      slots.unshift(slots.pop());
    }
    return rounds;
  }

  function generateMatchups(numTeams, mode, gpt) {
    if (mode === "roundrobin") {
      return { matchups: generateAllPairs(numTeams), gamesPerTeam: numTeams - 1 };
    }
    const allRounds = circleMethodRounds(numTeams);
    const matchups = [];
    const gamesCount = new Array(numTeams).fill(0);
    const usedPairs = new Set();

    for (const round of allRounds) {
      if (gamesCount.every(g => g >= gpt)) break;
      for (const [a, b] of fisherYatesShuffle(round)) {
        if (gamesCount[a] >= gpt || gamesCount[b] >= gpt) continue;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (usedPairs.has(key)) continue;
        usedPairs.add(key);
        matchups.push([a, b]);
        gamesCount[a]++;
        gamesCount[b]++;
      }
    }

    if (!gamesCount.every(g => g >= gpt)) {
      const remaining = generateAllPairs(numTeams).filter(([a, b]) => {
        const key = `${a}-${b}`;
        return !usedPairs.has(key);
      });
      for (const [a, b] of fisherYatesShuffle(remaining)) {
        if (gamesCount[a] >= gpt && gamesCount[b] >= gpt) continue;
        if (gamesCount[a] >= gpt || gamesCount[b] >= gpt) continue;
        const key = `${a}-${b}`;
        usedPairs.add(key);
        matchups.push([a, b]);
        gamesCount[a]++;
        gamesCount[b]++;
        if (gamesCount.every(g => g >= gpt)) break;
      }
    }
    return { matchups, gamesPerTeam: gpt };
  }

  // ── Schedule Generation (Phase 2) ─────────────────────────

  function trailingCount(history, value) {
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] === value) count++; else break;
    }
    return count;
  }

  function scheduleMatchups(matchupList, numTeams, numCourts) {
    const pool = matchupList.map(([a, b]) => [a, b]);
    const history = Array.from({ length: numTeams }, () => []);
    const sched = [];

    for (let iter = 0; iter < 500 && pool.length > 0; iter++) {
      const mustRestSet = new Set();
      const mustPlaySet = new Set();
      for (let t = 0; t < numTeams; t++) {
        const ps = trailingCount(history[t], "play");
        const rs = trailingCount(history[t], "rest");
        if (ps >= MAX_CONSECUTIVE_PLAY) mustRestSet.add(t);
        else if (rs >= MAX_CONSECUTIVE_REST) mustPlaySet.add(t);
      }

      const roundGames = [];
      const playingThisRound = new Set();

      const prioritized = [];
      const normal = [];
      for (let i = 0; i < pool.length; i++) {
        const [a, b] = pool[i];
        if (mustRestSet.has(a) || mustRestSet.has(b)) continue;
        if (mustPlaySet.has(a) || mustPlaySet.has(b)) prioritized.push(i);
        else normal.push(i);
      }

      let order = [...fisherYatesShuffle(prioritized), ...fisherYatesShuffle(normal)];

      if (order.length === 0 && mustPlaySet.size > 0) {
        for (let i = 0; i < pool.length; i++) {
          const [a, b] = pool[i];
          const aCanPlay = !mustRestSet.has(a) || mustPlaySet.has(a);
          const bCanPlay = !mustRestSet.has(b) || mustPlaySet.has(b);
          if (aCanPlay && bCanPlay) order.push(i);
        }
        order = fisherYatesShuffle(order);
      }

      const usedIndices = new Set();

      for (const idx of order) {
        if (roundGames.length >= numCourts) break;
        const [a, b] = pool[idx];
        if (playingThisRound.has(a) || playingThisRound.has(b)) continue;
        roundGames.push([a, b]);
        playingThisRound.add(a);
        playingThisRound.add(b);
        usedIndices.add(idx);
      }

      if (roundGames.length === 0) {
        for (let t = 0; t < numTeams; t++) history[t].push("rest");
        continue;
      }

      for (const idx of [...usedIndices].sort((a, b) => b - a)) pool.splice(idx, 1);
      sched.push(roundGames);

      for (let t = 0; t < numTeams; t++) {
        history[t].push(playingThisRound.has(t) ? "play" : "rest");
      }
    }

    return sched;
  }

  function countConstraintViolations(sched, numTeams) {
    const hist = Array.from({ length: numTeams }, () => []);
    for (const rd of sched) {
      const playing = new Set(rd.flat());
      for (let t = 0; t < numTeams; t++) hist[t].push(playing.has(t) ? "play" : "rest");
    }
    let violations = 0;
    for (let t = 0; t < numTeams; t++) {
      for (let i = 0; i <= hist[t].length - 3; i++) {
        const s = hist[t].slice(i, i + 3);
        if (s.every(x => x === "play") || s.every(x => x === "rest")) violations++;
      }
    }
    return violations;
  }

  function generateValidSchedule(teamList, numCourts, mode, gpt) {
    let bestSchedule = null;
    let bestScore = Infinity;
    let bestGpt = gpt;

    for (let attempt = 0; attempt < MAX_SCHEDULE_ATTEMPTS; attempt++) {
      const { matchups, gamesPerTeam: actualGpt } = generateMatchups(teamList.length, mode, gpt);
      const sched = scheduleMatchups(fisherYatesShuffle(matchups), teamList.length, numCourts);
      const scheduled = sched.reduce((s, r) => s + r.length, 0);
      const remaining = matchups.length - scheduled;
      const violations = countConstraintViolations(sched, teamList.length);
      const score = remaining * 1000 + violations;

      if (score === 0) {
        return { schedule: sched, gamesPerTeam: actualGpt };
      }
      if (score < bestScore) {
        bestScore = score;
        bestSchedule = sched;
        bestGpt = actualGpt;
      }
    }
    return { schedule: bestSchedule, gamesPerTeam: bestGpt };
  }

  // ── League Rendering ──────────────────────────────────────

  function renderTeams() {
    $teamsList.innerHTML = "";
    teams.forEach((team, i) => {
      const badge = document.createElement("div");
      badge.className = `team-badge team-color-${i % 24}`;
      badge.textContent = `${team.label}: ${team.players[0]} & ${team.players[1]}`;
      $teamsList.appendChild(badge);
    });
  }

  function renderScheduleWithButtons() {
    $schedHead.innerHTML = "";
    const headRow = document.createElement("tr");
    headRow.innerHTML = `<th>Round</th>`;
    for (let c = 0; c < currentCourts; c++) headRow.innerHTML += `<th>Court ${c + 1}</th>`;
    $schedHead.appendChild(headRow);

    $schedBody.innerHTML = "";
    schedule.forEach((roundGames, rIdx) => {
      const tr = document.createElement("tr");
      const tdRound = document.createElement("td");
      tdRound.className = "round-label";
      tdRound.textContent = `R${rIdx + 1}`;
      tr.appendChild(tdRound);

      for (let c = 0; c < currentCourts; c++) {
        const td = document.createElement("td");
        if (c < roundGames.length) {
          const [a, b] = roundGames[c];
          const winner = matchResults[rIdx][c];
          const scores = matchScores[rIdx] ? matchScores[rIdx][c] : null;

          let scoreHtml = "";
          if (winner !== null) {
            const aScore = (scores && scores[0] != null) ? scores[0] : "";
            const bScore = (scores && scores[1] != null) ? scores[1] : "";
            const aLbl = teams[a].label.replace("Team ", "T");
            const bLbl = teams[b].label.replace("Team ", "T");
            scoreHtml = `<div class="score-row">
              <span class="score-team-label">${aLbl}</span>
              <input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="a"
                     value="${aScore}" placeholder="\u2014" min="0" inputmode="numeric" />
              <span class="score-dash">\u2013</span>
              <input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="b"
                     value="${bScore}" placeholder="\u2014" min="0" inputmode="numeric" />
              <span class="score-team-label">${bLbl}</span>
            </div>`;
          }

          td.innerHTML = `<div class="match-cell">
            <div class="match-teams-row">
              <button class="team-btn team-color-${a % 24} ${winner === a ? 'winner' : (winner !== null ? 'loser' : '')}"
                      data-round="${rIdx}" data-court="${c}" data-team="${a}">${teams[a].label}</button>
              <span class="vs-label">vs</span>
              <button class="team-btn team-color-${b % 24} ${winner === b ? 'winner' : (winner !== null ? 'loser' : '')}"
                      data-round="${rIdx}" data-court="${c}" data-team="${b}">${teams[b].label}</button>
            </div>
            ${scoreHtml}
          </div>`;
        } else {
          td.textContent = "\u2014";
          td.style.color = "#aaa";
        }
        tr.appendChild(td);
      }
      $schedBody.appendChild(tr);
    });
  }

  function getLeaderboard() {
    const stats = teams.map((t, i) => ({ idx: i, played: 0, won: 0, lost: 0, diff: 0 }));
    for (let r = 0; r < schedule.length; r++) {
      for (let c = 0; c < schedule[r].length; c++) {
        const [a, b] = schedule[r][c];
        const w = matchResults[r][c];
        if (w !== null) {
          const loserIdx = w === a ? b : a;
          stats[a].played++;
          stats[b].played++;
          stats[w].won++;
          stats[loserIdx].lost++;

          const scores = matchScores[r] ? matchScores[r][c] : null;
          if (scores && scores[0] != null && scores[1] != null
              && !isNaN(scores[0]) && !isNaN(scores[1])) {
            const winnerScore = (w === a) ? scores[0] : scores[1];
            const loserScore  = (w === a) ? scores[1] : scores[0];
            const d = winnerScore - loserScore;
            stats[w].diff += d;
            stats[loserIdx].diff -= d;
          }
        }
      }
    }
    stats.sort((a, b) => b.won - a.won || b.diff - a.diff || a.lost - b.lost || a.idx - b.idx);
    return stats;
  }

  function renderLeaderboard() {
    const stats = getLeaderboard();
    const qualifyCount = teams.length === 3 ? 3 : 4;
    $leaderboardBody.innerHTML = "";
    stats.forEach((s, rank) => {
      const tr = document.createElement("tr");
      if (rank < qualifyCount) tr.className = "rank-qualified";
      const diffStr = s.diff > 0 ? `+${s.diff}` : `${s.diff}`;
      const diffCls = s.diff > 0 ? "diff-pos" : (s.diff < 0 ? "diff-neg" : "");
      tr.innerHTML = `<td>${rank + 1}</td>
        <td>${teamSpan(s.idx)}</td>
        <td>${s.played}</td>
        <td>${s.won}</td>
        <td>${s.lost}</td>
        <td><strong>${s.won}</strong></td>
        <td class="${diffCls}"><strong>${diffStr}</strong></td>`;
      $leaderboardBody.appendChild(tr);
    });
  }

  function updateLeagueProgress() {
    let total = 0, done = 0;
    for (let r = 0; r < schedule.length; r++) {
      for (let c = 0; c < schedule[r].length; c++) {
        total++;
        if (matchResults[r][c] !== null) done++;
      }
    }
    $leagueProgress.textContent = `${done} / ${total} matches recorded`;
    btnToSemis.disabled = (done < total);
  }

  function handleMatchClick(e) {
    const btn = e.target.closest(".team-btn");
    if (!btn) return;
    const r = parseInt(btn.dataset.round);
    const c = parseInt(btn.dataset.court);
    const t = parseInt(btn.dataset.team);
    const prev = matchResults[r][c];
    matchResults[r][c] = (prev === t) ? null : t;
    if (matchResults[r][c] === null) {
      matchScores[r][c] = null;
    }
    renderScheduleWithButtons();
    renderLeaderboard();
    updateLeagueProgress();
    saveState();
  }

  function handleScoreInput(e) {
    const inp = e.target.closest(".score-input");
    if (!inp) return;
    const r = parseInt(inp.dataset.round);
    const c = parseInt(inp.dataset.court);
    const side = inp.dataset.side;

    if (!matchScores[r]) matchScores[r] = schedule[r].map(() => null);
    if (!matchScores[r][c]) matchScores[r][c] = [null, null];

    const parsed = parseInt(inp.value, 10);
    const val = (inp.value === "" || isNaN(parsed)) ? null : parsed;
    if (side === "a") matchScores[r][c][0] = val;
    else matchScores[r][c][1] = val;

    renderLeaderboard();
    saveState();
  }

  // ── Semi-Finals ───────────────────────────────────────────

  function is3TeamMode() {
    return teams.length === 3;
  }

  function renderSemis(fromSaved) {
    if (is3TeamMode()) renderSemis3(fromSaved);
    else renderSemis4(fromSaved);
  }

  function renderSemis3(fromSaved) {
    if (!fromSaved) {
      const lb = getLeaderboard();
      semiTeams = [lb[0].idx, lb[1].idx, lb[2].idx];
      semiWinners = [null];
    }
    $semisInfo.innerHTML = `Table Topper: ${teamSpan(semiTeams[0])} advances directly to Final`;
    $semisMatches.innerHTML = "";
    const byeDiv = document.createElement("div");
    byeDiv.className = "bye-banner";
    byeDiv.innerHTML = `${teamSpan(semiTeams[0])} (1st Place) \u2014 BYE to Final`;
    $semisMatches.appendChild(byeDiv);
    const a = semiTeams[1], b = semiTeams[2];
    const div = document.createElement("div");
    div.className = "knockout-match";
    div.innerHTML = `<div class="match-title">Semi-Final: 2nd vs 3rd</div>
      <div class="match-teams">
        <button class="ko-team-btn team-color-${a % 24}" data-semi="0" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button>
        <span class="ko-vs">VS</span>
        <button class="ko-team-btn team-color-${b % 24}" data-semi="0" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button>
      </div>`;
    $semisMatches.appendChild(div);
    btnToFinals.disabled = true;
    if (fromSaved) updateSemiUI();
  }

  function renderSemis4(fromSaved) {
    if (!fromSaved) {
      const lb = getLeaderboard();
      semiTeams = [lb[0].idx, lb[3].idx, lb[1].idx, lb[2].idx];
      semiWinners = [null, null];
    }
    $semisInfo.innerHTML = `Top 4 qualify: ${teamSpan(semiTeams[0])}, ${teamSpan(semiTeams[2])}, ${teamSpan(semiTeams[3])}, ${teamSpan(semiTeams[1])}`;
    $semisMatches.innerHTML = "";
    for (let m = 0; m < 2; m++) {
      const a = semiTeams[m * 2], b = semiTeams[m * 2 + 1];
      const seedA = m === 0 ? "Seed 1" : "Seed 2";
      const seedB = m === 0 ? "Seed 4" : "Seed 3";
      const div = document.createElement("div");
      div.className = "knockout-match";
      div.innerHTML = `<div class="match-title">Semi-Final ${m + 1}: ${seedA} vs ${seedB}</div>
        <div class="match-teams">
          <button class="ko-team-btn team-color-${a % 24}" data-semi="${m}" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button>
          <span class="ko-vs">VS</span>
          <button class="ko-team-btn team-color-${b % 24}" data-semi="${m}" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button>
        </div>`;
      $semisMatches.appendChild(div);
    }
    btnToFinals.disabled = true;
    if (fromSaved) updateSemiUI();
  }

  function handleSemiClick(e) {
    const btn = e.target.closest(".ko-team-btn");
    if (!btn || btn.dataset.semi === undefined) return;
    const m = parseInt(btn.dataset.semi);
    const t = parseInt(btn.dataset.team);
    semiWinners[m] = (semiWinners[m] === t) ? null : t;
    updateSemiUI();
    saveState();
  }

  function updateSemiUI() {
    const btns = $semisMatches.querySelectorAll(".ko-team-btn");
    btns.forEach(btn => {
      const m = parseInt(btn.dataset.semi);
      const t = parseInt(btn.dataset.team);
      btn.classList.toggle("winner", semiWinners[m] === t);
      btn.classList.toggle("loser", semiWinners[m] !== null && semiWinners[m] !== t);
    });
    btnToFinals.disabled = semiWinners.includes(null);
  }

  // ── Finals ────────────────────────────────────────────────

  function renderFinals(fromSaved) {
    if (!fromSaved) { finalWinner = null; finalLoser = null; }
    let a, b;
    if (is3TeamMode()) { a = semiTeams[0]; b = semiWinners[0]; }
    else { a = semiWinners[0]; b = semiWinners[1]; }
    $finalsMatch.innerHTML = "";
    const div = document.createElement("div");
    div.className = "knockout-match";
    const titleExtra = is3TeamMode() ? " (Table Topper vs Semi Winner)" : "";
    div.innerHTML = `<div class="match-title">FINAL${titleExtra}</div>
      <div class="match-teams">
        <button class="ko-team-btn team-color-${a % 24}" data-final="1" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button>
        <span class="ko-vs">VS</span>
        <button class="ko-team-btn team-color-${b % 24}" data-final="1" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button>
      </div>`;
    $finalsMatch.appendChild(div);
    btnToSummary.disabled = true;
    if (fromSaved) updateFinalUI();
  }

  function handleFinalClick(e) {
    const btn = e.target.closest(".ko-team-btn");
    if (!btn || !btn.dataset.final) return;
    const t = parseInt(btn.dataset.team);
    let a, b;
    if (is3TeamMode()) { a = semiTeams[0]; b = semiWinners[0]; }
    else { a = semiWinners[0]; b = semiWinners[1]; }
    if (finalWinner === t) { finalWinner = null; finalLoser = null; }
    else { finalWinner = t; finalLoser = (t === a) ? b : a; }
    updateFinalUI();
    saveState();
  }

  function updateFinalUI() {
    const btns = $finalsMatch.querySelectorAll(".ko-team-btn");
    btns.forEach(btn => {
      const t = parseInt(btn.dataset.team);
      btn.classList.toggle("winner", finalWinner === t);
      btn.classList.toggle("loser", finalWinner !== null && finalWinner !== t);
    });
    btnToSummary.disabled = (finalWinner === null);
  }

  // ── Final Summary & Cost ──────────────────────────────────

  function renderSummary() {
    $finalStandings.innerHTML = "";
    [{ rank: "\uD83C\uDFC6", label: "Champions", teamIdx: finalWinner, cls: "gold" },
     { rank: "\uD83E\uDD48", label: "Runners-up", teamIdx: finalLoser, cls: "silver" }
    ].forEach(item => {
      const t = teams[item.teamIdx];
      const div = document.createElement("div");
      div.className = `standing-item ${item.cls}`;
      div.innerHTML = `<span class="standing-rank">${item.rank}</span>
        <span>${item.label}: <strong>${t.label}</strong> \u2014 ${t.players.join(" & ")}</span>`;
      $finalStandings.appendChild(div);
    });
    $costResultsSection.hidden = true;
  }

  function calculateCost() {
    const court = parseFloat($courtCost.value) || 0;
    const shuttle = parseFloat($shuttleCost.value) || 0;
    const totalCost = court + shuttle;
    const numP = currentPlayers.length;
    const x = totalCost / (numP - 3);
    const halfX = x / 2;
    const winnerSet = new Set(teams[finalWinner].players);
    const loserSet  = new Set(teams[finalLoser].players);

    $costSummaryInfo.innerHTML =
      `Total: <strong>${totalCost.toFixed(2)}</strong> | Normal share: <strong>${x.toFixed(2)}</strong> | Runner share (each): <strong>${halfX.toFixed(2)}</strong> | Winner share: <strong>0.00</strong>`;

    $costBody.innerHTML = "";
    let checkSum = 0;
    currentPlayers.forEach(player => {
      const tr = document.createElement("tr");
      let standing, amount, cls;
      const playerTeam = teams.find(t => t.players.includes(player));
      if (winnerSet.has(player))      { standing = "\uD83C\uDFC6 Champion"; amount = 0;     cls = "pay-zero"; }
      else if (loserSet.has(player))  { standing = "\uD83E\uDD48 Runner-up"; amount = halfX; cls = "pay-half"; }
      else                            { standing = "\u2014";                 amount = x;     cls = "pay-full"; }
      checkSum += amount;
      tr.innerHTML = `<td style="text-align:left;font-weight:500">${player}</td>
        <td>${playerTeam ? playerTeam.label : '\u2014'}</td><td>${standing}</td>
        <td class="${cls}">${amount.toFixed(2)}</td>`;
      $costBody.appendChild(tr);
    });
    $costTotal.innerHTML = `Total collected: <strong>${checkSum.toFixed(2)}</strong> / ${totalCost.toFixed(2)}`;
    $costResultsSection.hidden = false;
  }

  // ── Start League Phase ────────────────────────────────────

  function startLeaguePhase() {
    gameMode = getSelectedGameMode();
    const gpt = (gameMode === "roundrobin") ? teams.length - 1 : parseInt($numGamesPerTeam.value, 10);
    const result = generateValidSchedule(teams, currentCourts, gameMode, gpt);
    schedule = result.schedule;
    gamesPerTeam = result.gamesPerTeam;

    matchResults = schedule.map(round => round.map(() => null));
    matchScores  = schedule.map(round => round.map(() => null));

    const modeLabel = gameMode === "roundrobin" ? "Full Round-Robin" : `${gamesPerTeam} games/team`;
    $gamesInfo.textContent = `${teams.length} teams, ${currentCourts} court(s), ${modeLabel}`;

    renderTeams();
    renderScheduleWithButtons();
    renderLeaderboard();
    updateLeagueProgress();
    showStep($stepLeague);
  }

  function handleGenerate() {
    clearError($namesError);
    const result = gatherNames();
    if (result.error) { showError($namesError, result.error); return; }
    currentPlayers = result.names;
    teamMode = getSelectedTeamMode();

    if (teamMode === "fixed") {
      const ft = gatherFixedTeams();
      if (ft.errors.length) { showError($namesError, ft.errors[0]); return; }
      if (ft.assigned.size < currentPlayers.length) {
        showError($namesError, `All ${currentPlayers.length} players must be assigned in "All Fixed" mode. ${currentPlayers.length - ft.assigned.size} unassigned.`);
        return;
      }
      teams = buildTeamsFromPairs(ft.fixed);
      startLeaguePhase();

    } else if (teamMode === "mixed") {
      const ft = gatherFixedTeams();
      if (ft.errors.length) { showError($namesError, ft.errors[0]); return; }
      const unassigned = currentPlayers.filter(n => !ft.assigned.has(n));
      if (unassigned.length === 0) {
        teams = buildTeamsFromPairs(ft.fixed);
        startLeaguePhase();
      } else if (unassigned.length % 2 !== 0) {
        showError($namesError, `${unassigned.length} unassigned players (odd). Need even number for card pick.`);
        return;
      } else {
        initCardPick(unassigned, ft.fixed);
        showStep($stepCardpick);
      }

    } else {
      initCardPick(currentPlayers, []);
      showStep($stepCardpick);
    }
  }

  // ── Event Listeners ───────────────────────────────────────

  $gameModeGroup.addEventListener("change", updateGptVisibility);
  $teamModeGroup.addEventListener("change", updateTeamModeVisibility);

  $numPlayers.addEventListener("input", () => {
    const n = parseInt($numPlayers.value, 10);
    if (!isNaN(n) && n >= 6 && n % 2 === 0) {
      const maxG = (n / 2) - 1;
      $gptHint.textContent = `1 to ${maxG} games, no duplicate matchups`;
      if (parseInt($numGamesPerTeam.value, 10) > maxG) $numGamesPerTeam.value = maxG;
    }
  });

  btnNext.addEventListener("click", () => {
    clearError($setupError);
    const err = validateSetup();
    if (err) { showError($setupError, err); return; }
    currentCourts = parseInt($numCourts.value, 10);
    buildNameFields(parseInt($numPlayers.value, 10));
    fixedPairs = [];
    pendingPick = null;
    updateTeamModeVisibility();
    showStep($stepNames);
  });

  btnBack.addEventListener("click", () => { clearError($namesError); showStep($stepSetup); });
  btnGenerate.addEventListener("click", handleGenerate);

  $fixedChipsPool.addEventListener("click", (e) => {
    const chip = e.target.closest(".player-chip");
    if (chip) handleChipClick(chip.dataset.name);
  });

  $fixedPairsDone.addEventListener("click", (e) => {
    const btn = e.target.closest(".fixed-pair-remove");
    if (btn) removeFixedPair(parseInt(btn.dataset.pair, 10));
  });

  btnBackToNames.addEventListener("click", () => {
    cardPickState = null;
    buildNameFields(currentPlayers.length);
    const inputs = $nameFields.querySelectorAll("input");
    currentPlayers.forEach((name, i) => { if (inputs[i]) inputs[i].value = name; });
    updateTeamModeVisibility();
    showStep($stepNames);
  });

  btnStartLeague.addEventListener("click", () => {
    finalizeTeamsFromCardPick();
  });

  btnLeagueRestart.addEventListener("click", () => {
    if (!confirm("This will erase the current tournament. Are you sure?")) return;
    clearState();
    showStep($stepSetup);
  });
  btnLeagueReRandom.addEventListener("click", () => {
    if (!confirm("This will re-randomize all teams and erase match results. Are you sure?")) return;
    clearState();
    teams = formTeams(currentPlayers);
    startLeaguePhase();
  });

  $schedBody.addEventListener("click", handleMatchClick);
  $schedBody.addEventListener("input", handleScoreInput);

  btnToSemis.addEventListener("click", () => { renderSemis(); showStep($stepSemis); });
  btnBackToLeague.addEventListener("click", () => showStep($stepLeague));
  $semisMatches.addEventListener("click", handleSemiClick);

  btnToFinals.addEventListener("click", () => { renderFinals(); showStep($stepFinals); });
  btnBackToSemis.addEventListener("click", () => showStep($stepSemis));
  $finalsMatch.addEventListener("click", handleFinalClick);

  btnToSummary.addEventListener("click", () => { renderSummary(); showStep($stepSummary); });
  btnCalcCost.addEventListener("click", calculateCost);
  btnSummaryRestart.addEventListener("click", () => {
    if (!confirm("Start a new tournament? Current results will be cleared.")) return;
    clearState();
    showStep($stepSetup);
  });
  btnPrint.addEventListener("click", () => window.print());

  // ── Startup ───────────────────────────────────────────────
  updateGptVisibility();
  if (loadState()) {
    restoreView();
  }
})();
