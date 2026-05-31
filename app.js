(function () {
  "use strict";

  const MAX_CONSECUTIVE_PLAY = 2;
  const MAX_CONSECUTIVE_REST = 2;
  const MAX_SCHEDULE_ATTEMPTS = 200;
  const FLEX_SCHEDULE_ATTEMPTS = 60;

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
  const $tournamentFormatGroup = document.getElementById("tournamentFormatGroup");
  const $gameModeGroup = document.getElementById("gameModeGroup");
  const $gptGroup      = document.getElementById("gptGroup");
  const $numGamesPerTeam = document.getElementById("numGamesPerTeam");
  const $gptHint         = document.getElementById("gptHint");
  const $gptLabel        = document.getElementById("gptLabel");
  const $gameModeSpecifyLabel = document.getElementById("gameModeSpecifyLabel");
  const $gameModeRRLabel      = document.getElementById("gameModeRRLabel");

  const $nameFields = document.getElementById("nameFields");
  const $namesError = document.getElementById("names-error");
  const $teamModeSection = document.getElementById("teamModeSection");
  const $teamModeGroup   = document.getElementById("teamModeGroup");
  const $fixedTeamsArea  = document.getElementById("fixedTeamsArea");
  const $fixedPairsDone  = document.getElementById("fixedPairsDone");
  const $fixedChipsPool  = document.getElementById("fixedChipsPool");
  const $fixedTeamsHint  = document.getElementById("fixedTeamsHint");

  const $pickBanner = document.getElementById("pickBanner");
  const $pickGrid   = document.getElementById("pickGrid");
  const $pickLog    = document.getElementById("pickLog");
  const $pickDone   = document.getElementById("pickDone");
  const btnStartLeague = document.getElementById("btnStartLeague");
  const btnBackToNames = document.getElementById("btnBackToNames");

  const $gamesInfo       = document.getElementById("gamesInfo");
  const $teamsHeader     = document.getElementById("teamsHeader");
  const $teamsList       = document.getElementById("teamsList");
  const $schedHead       = document.getElementById("scheduleHead");
  const $schedBody       = document.getElementById("scheduleBody");
  const $leaderboardHead = document.getElementById("leaderboardHead");
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
  let tournamentFormat = "fixed";
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

  let flexSchedule = [];
  let flexMatchResults = [];
  let flexMatchScores = [];
  let gamesPerPlayer = 3;

  let selectedFilter = null;
  let unavailableSet = new Set();

  const STORAGE_KEY = "matchpoint_tournament";

  // ── Persistence ─────────────────────────────────────────

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentPlayers, currentCourts, tournamentFormat, gameMode, teamMode,
        teams, schedule, gamesPerTeam, matchResults, matchScores,
        semiTeams, semiWinners, finalWinner, finalLoser, currentStep, cardPickState,
        flexSchedule, flexMatchResults, flexMatchScores, gamesPerPlayer,
        unavailableKeys: Array.from(unavailableSet)
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

      tournamentFormat = s.tournamentFormat || "fixed";

      if (tournamentFormat === "flexible") {
        if (s.currentStep === "cardpick") {
          if (!s.cardPickState) return false;
        } else {
          if (!s.flexSchedule || !s.flexSchedule.length) return false;
        }
        const koSteps = ["semis", "finals", "summary"];
        if (koSteps.includes(s.currentStep) && (!s.teams || !s.teams.length)) return false;
      } else {
        if (s.currentStep === "cardpick" && !s.cardPickState) return false;
        if (s.currentStep !== "cardpick" && (!s.teams || !s.teams.length || !s.schedule)) return false;
      }

      currentPlayers = s.currentPlayers;
      currentCourts  = s.currentCourts;
      gameMode       = s.gameMode || "specify";
      teamMode       = s.teamMode || "random";
      teams          = s.teams || [];
      schedule       = s.schedule || [];
      gamesPerTeam   = s.gamesPerTeam || 3;
      matchResults   = s.matchResults || [];
      matchScores    = s.matchScores || (schedule.length ? schedule.map(r => r.map(() => null)) : []);
      semiTeams      = s.semiTeams || [];
      semiWinners    = s.semiWinners || [null, null];
      finalWinner    = s.finalWinner;
      finalLoser     = s.finalLoser;
      currentStep    = s.currentStep || "league";
      cardPickState  = s.cardPickState || null;

      flexSchedule     = s.flexSchedule || [];
      flexMatchResults = s.flexMatchResults || (flexSchedule.length ? flexSchedule.map(r => r.map(() => null)) : []);
      flexMatchScores  = s.flexMatchScores || (flexSchedule.length ? flexSchedule.map(r => r.map(() => null)) : []);
      gamesPerPlayer   = s.gamesPerPlayer || 3;
      unavailableSet   = new Set(s.unavailableKeys || []);

      return true;
    } catch (_) {
      return false;
    }
  }

  function restoreView() {
    if (currentStep === "cardpick" && cardPickState) {
      restoreCardPick();
      if (cardPickState.purpose === "knockout") {
        btnStartLeague.textContent = "Start Knockout \u2192";
        btnBackToNames.textContent = "\u2190 Back to League";
      } else {
        btnStartLeague.textContent = "Start Tournament \u2192";
        btnBackToNames.textContent = "\u2190 Back to Names";
      }
      allSteps.forEach(st => st.hidden = true);
      $stepCardpick.hidden = false;
      return;
    }

    if (tournamentFormat === "flexible") {
      restoreFlexLeague();
    } else {
      restoreFixedLeague();
    }
  }

  function restoreFixedLeague() {
    clearFilter();
    const modeLabel = gameMode === "roundrobin" ? "Full Round-Robin" : `${gamesPerTeam} games/team`;
    $gamesInfo.textContent = `${teams.length} teams, ${currentCourts} court(s), ${modeLabel}`;
    $teamsHeader.innerHTML = "&#129309; Teams";
    renderTeams();
    renderScheduleWithButtons();
    renderFixedLeaderboardHeader();
    renderLeaderboard();
    updateLeagueProgress();
    btnToSemis.style.display = "";
    btnLeagueReRandom.style.display = "";

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

    applyUnavailableOverlay();
    allSteps.forEach(st => st.hidden = true);
    (stepEl[currentStep] || $stepLeague).hidden = false;
  }

  function restoreFlexLeague() {
    clearFilter();
    const modeLabel = gameMode === "roundrobin" ? "Max Games" : `${gamesPerPlayer} games/player`;
    $gamesInfo.textContent = `${currentPlayers.length} players, ${currentCourts} court(s), Flexible, ${modeLabel}`;
    $teamsHeader.innerHTML = "&#127919; Players";
    renderFlexPlayers();
    renderFlexSchedule();
    renderFlexLeaderboardHeader();
    renderFlexLeaderboard();
    updateFlexProgress();

    if (currentPlayers.length >= 8) {
      btnToSemis.style.display = "";
      btnToSemis.innerHTML = "Knockout Card Pick &rarr;";
    } else {
      btnToSemis.style.display = "none";
    }
    btnLeagueReRandom.style.display = "";

    const stepEl = { league: $stepLeague, semis: $stepSemis, finals: $stepFinals, summary: $stepSummary };

    if (currentStep === "semis" || currentStep === "finals" || currentStep === "summary") {
      renderSemis(true);
    }
    if (currentStep === "finals" || currentStep === "summary") {
      renderFinals(true);
    }
    if (currentStep === "summary") {
      renderSummary();
    }

    applyUnavailableOverlay();
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
    const len = a.length;
    if (len <= 1) return a;
    const buf = new Uint32Array(len - 1);
    crypto.getRandomValues(buf);
    for (let i = len - 1; i > 0; i--) {
      const j = buf[len - 1 - i] % (i + 1);
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

  function pairKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function getSelectedFormat() {
    const checked = $tournamentFormatGroup.querySelector('input[name="tournamentFormat"]:checked');
    return checked ? checked.value : "fixed";
  }

  function getSelectedGameMode() {
    const checked = $gameModeGroup.querySelector('input[name="gameMode"]:checked');
    return checked ? checked.value : "specify";
  }

  function getSelectedTeamMode() {
    const checked = $teamModeGroup.querySelector('input[name="teamMode"]:checked');
    return checked ? checked.value : "random";
  }

  function updateFormatVisibility() {
    const fmt = getSelectedFormat();
    if (fmt === "flexible") {
      $gameModeSpecifyLabel.textContent = "Specify games per player";
      $gameModeRRLabel.textContent = "Max Games (all partner combos)";
      $gptLabel.textContent = "Games Per Player";
    } else {
      $gameModeSpecifyLabel.textContent = "Specify games per team";
      $gameModeRRLabel.textContent = "Full Round-Robin";
      $gptLabel.textContent = "Games Per Team";
    }
    updateGptVisibility();
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

  // ── Badge filter (click-to-highlight) ────────────────────

  function toggleFilter(type, value) {
    if (selectedFilter && selectedFilter.type === type && selectedFilter.value === value) {
      selectedFilter = null;
    } else {
      selectedFilter = { type, value };
    }
    applyFilter();
  }

  function applyFilter() {
    const badges = $teamsList.querySelectorAll(".team-badge");
    badges.forEach(badge => {
      if (!selectedFilter) {
        badge.classList.remove("badge-active", "badge-dimmed");
        return;
      }
      let isMatch = false;
      if (selectedFilter.type === "team") {
        isMatch = parseInt(badge.dataset.teamIdx) === selectedFilter.value;
      } else {
        isMatch = badge.dataset.playerName === selectedFilter.value;
      }
      badge.classList.toggle("badge-active", isMatch);
      badge.classList.toggle("badge-dimmed", !isMatch);
    });

    const rows = $schedBody.querySelectorAll("tr");
    rows.forEach((row, rIdx) => {
      row.classList.remove("filter-resting");
      row.querySelectorAll(".match-highlighted").forEach(el => el.classList.remove("match-highlighted"));

      if (!selectedFilter) return;

      let inRound = false;
      const cells = row.querySelectorAll("td");

      if (selectedFilter.type === "team" && tournamentFormat === "fixed" && schedule[rIdx]) {
        schedule[rIdx].forEach(([a, b], cIdx) => {
          if (a === selectedFilter.value || b === selectedFilter.value) {
            inRound = true;
            const mc = cells[cIdx + 1] && cells[cIdx + 1].querySelector(".match-cell");
            if (mc) mc.classList.add("match-highlighted");
          }
        });
      } else if (selectedFilter.type === "player" && tournamentFormat === "flexible" && flexSchedule[rIdx]) {
        flexSchedule[rIdx].forEach((m, cIdx) => {
          if (m.teamA.includes(selectedFilter.value) || m.teamB.includes(selectedFilter.value)) {
            inRound = true;
            const mc = cells[cIdx + 1] && cells[cIdx + 1].querySelector(".match-cell");
            if (mc) mc.classList.add("match-highlighted");
          }
        });
      }

      if (!inRound) row.classList.add("filter-resting");
    });
  }

  function clearFilter() {
    selectedFilter = null;
  }

  // ── Availability toggle (mark away / back) ──────────────

  function toggleAvailability(key) {
    if (unavailableSet.has(key)) unavailableSet.delete(key);
    else unavailableSet.add(key);
    applyAvailability();
    saveState();
  }

  function applyAvailability() {
    $teamsList.querySelectorAll(".team-badge").forEach(badge => {
      const key = badge.dataset.teamIdx !== undefined
        ? parseInt(badge.dataset.teamIdx)
        : badge.dataset.playerName;
      const away = unavailableSet.has(key);
      badge.classList.toggle("badge-unavailable", away);
      const tog = badge.querySelector(".badge-toggle");
      if (tog) tog.textContent = away ? "\u25B6" : "\u23F8";
    });
    applyUnavailableOverlay();
  }

  function applyUnavailableOverlay() {
    if (unavailableSet.size === 0) {
      $schedBody.querySelectorAll(".match-unavailable").forEach(el => el.classList.remove("match-unavailable"));
      return;
    }
    const rows = $schedBody.querySelectorAll("tr");
    rows.forEach((row, rIdx) => {
      const cells = row.querySelectorAll("td");
      for (let c = 1; c < cells.length; c++) {
        const cell = cells[c];
        const matchEl = cell.querySelector(".match-cell");
        if (!matchEl) continue;
        let involved = false;
        if (tournamentFormat === "fixed" && schedule[rIdx] && schedule[rIdx][c - 1]) {
          const [a, b] = schedule[rIdx][c - 1];
          involved = unavailableSet.has(a) || unavailableSet.has(b);
        } else if (tournamentFormat === "flexible" && flexSchedule[rIdx] && flexSchedule[rIdx][c - 1]) {
          const m = flexSchedule[rIdx][c - 1];
          involved = m.teamA.some(p => unavailableSet.has(p)) || m.teamB.some(p => unavailableSet.has(p));
        }
        matchEl.classList.toggle("match-unavailable", involved);
      }
    });
  }

  // ── Step 1 validation ────────────────────────────────────

  function validateSetup() {
    const n = parseInt($numPlayers.value, 10);
    const c = parseInt($numCourts.value, 10);
    const fmt = getSelectedFormat();

    if (fmt === "flexible") {
      if (isNaN(n) || n < 4 || n > 30) return "Players must be between 4 and 30.";
      if (isNaN(c) || c < 1 || c > 4) return "Courts must be between 1 and 4.";
      const minPlayers = c * 6;
      if (n < minPlayers) {
        return `Need at least ${minPlayers} players for ${c} court(s) with rest constraints.`;
      }
      const mode = getSelectedGameMode();
      if (mode === "specify") {
        const g = parseInt($numGamesPerTeam.value, 10);
        if (isNaN(g) || g < 1 || g > n - 1) return `Games per player must be between 1 and ${n - 1}.`;
        if ((n * g) % 4 !== 0) {
          return `${n} players \u00d7 ${g} games = ${n * g} player-slots (not divisible by 4, since each match needs 4 players). Try ${g - 1} or ${g + 1} games instead.`;
        }
      }
    } else {
      if (isNaN(n) || n < 6 || n > 30) return "Players must be between 6 and 30.";
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
    if (pendingPick === null) { pendingPick = name; }
    else if (pendingPick === name) { pendingPick = null; }
    else { fixedPairs.push([pendingPick, name]); pendingPick = null; }
    rebuildFixedUI();
  }

  function removeFixedPair(idx) {
    fixedPairs.splice(idx, 1);
    pendingPick = null;
    rebuildFixedUI();
  }

  function gatherFixedTeams() {
    return { fixed: fixedPairs.slice(), assigned: new Set(fixedPairs.flat()), errors: [] };
  }

  // ── Team Generation (Fixed mode) ──────────────────────────

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

  function initCardPick(playersToRandomize, fpairs, purpose, rankMap) {
    const numRandomTeams = playersToRandomize.length / 2;
    const startTeamNum = fpairs.length + 1;
    const cardValues = [];
    for (let t = 0; t < numRandomTeams; t++) { cardValues.push(startTeamNum + t); cardValues.push(startTeamNum + t); }
    cardPickState = {
      fixedPairs: fpairs, playerQueue: fisherYatesShuffle(playersToRandomize),
      cardValues: fisherYatesShuffle(cardValues), revealed: cardValues.map(() => false),
      picks: {}, currentPickIndex: 0, teamAssignments: {},
      purpose: purpose || "league", playerRanks: rankMap || null
    };
    renderCardPick(); saveState();
  }

  function renderCardPick() {
    const s = cardPickState; if (!s) return;
    const allDone = s.currentPickIndex >= s.playerQueue.length;
    if (allDone) { $pickBanner.innerHTML = `<span class="pick-complete">All players have picked!</span>`; $pickDone.hidden = false; }
    else { $pickBanner.innerHTML = `<span class="pick-player-name">${s.playerQueue[s.currentPickIndex]}</span>, pick a card!`; $pickDone.hidden = true; }
    $pickGrid.innerHTML = "";
    s.cardValues.forEach((val, i) => {
      const card = document.createElement("div");
      card.className = "pick-card" + (s.revealed[i] ? " flipped" : "");
      card.dataset.index = i;
      if (s.revealed[i]) { card.innerHTML = `<div class="pick-card-face pick-card-back">?</div><div class="pick-card-face pick-card-front team-color-${(val-1) % 24}">T${val}</div>`; }
      else { card.innerHTML = `<div class="pick-card-face pick-card-back">?</div>`; }
      if (!s.revealed[i] && !allDone) card.addEventListener("click", () => handleCardClick(i));
      $pickGrid.appendChild(card);
    });
    renderPickLog();
  }

  function handleCardClick(cardIndex) {
    const s = cardPickState; if (!s || s.revealed[cardIndex] || s.currentPickIndex >= s.playerQueue.length) return;
    const playerName = s.playerQueue[s.currentPickIndex], teamNum = s.cardValues[cardIndex];
    s.revealed[cardIndex] = true; s.picks[playerName] = teamNum;
    if (!s.teamAssignments[teamNum]) s.teamAssignments[teamNum] = [playerName]; else s.teamAssignments[teamNum].push(playerName);
    s.currentPickIndex++;
    renderCardPick(); saveState();
  }

  function renderPickLog() {
    const s = cardPickState; $pickLog.innerHTML = "";
    const entries = [];
    for (let i = 0; i < s.currentPickIndex; i++) {
      const player = s.playerQueue[i], teamNum = s.picks[player];
      let html = `<span class="pick-log-player">${player}</span> picked <span class="team-color-${(teamNum-1) % 24}" style="padding:1px 6px;border-radius:4px;">Team ${teamNum}</span>`;
      if (s.teamAssignments[teamNum] && s.teamAssignments[teamNum].length === 2 && s.teamAssignments[teamNum][1] === player)
        html += ` &mdash; Team ${teamNum} complete! (${s.teamAssignments[teamNum][0]} &amp; ${player})`;
      entries.push(html);
    }
    entries.reverse().forEach(html => { const div = document.createElement("div"); div.className = "pick-log-entry"; div.innerHTML = html; $pickLog.appendChild(div); });
  }

  function restoreCardPick() { renderCardPick(); }

  function finalizeTeamsFromCardPick() {
    const s = cardPickState;
    if (s.purpose === "knockout") { finalizeKnockoutTeams(); return; }
    const allPairs = [...s.fixedPairs];
    Object.keys(s.teamAssignments).map(Number).sort((a, b) => a - b).forEach(num => {
      const pair = s.teamAssignments[num]; if (pair && pair.length === 2) allPairs.push([pair[0], pair[1]]);
    });
    teams = buildTeamsFromPairs(allPairs); cardPickState = null;
    startFixedLeaguePhase();
  }

  function startFlexKnockoutPick() {
    const lb = getFlexLeaderboard();
    if (lb.length < 8) return;
    const top8 = lb.slice(0, 8);
    const rankMap = {};
    top8.forEach((s, i) => { rankMap[s.name] = i + 1; });
    initCardPick(top8.map(s => s.name), [], "knockout", rankMap);
    btnStartLeague.textContent = "Start Knockout \u2192";
    btnBackToNames.textContent = "\u2190 Back to League";
    $pickBanner.insertAdjacentHTML("beforebegin",
      `<div class="games-info" id="knockoutBanner" style="margin-bottom:0.5rem">Top 8 players pick cards to form 4 knockout teams!</div>`);
    showStep($stepCardpick);
  }

  function finalizeKnockoutTeams() {
    const s = cardPickState;
    const allPairs = [];
    Object.keys(s.teamAssignments).map(Number).sort((a, b) => a - b).forEach(num => {
      const pair = s.teamAssignments[num];
      if (pair && pair.length === 2) allPairs.push([pair[0], pair[1]]);
    });
    teams = buildTeamsFromPairs(allPairs);
    const rankMap = s.playerRanks || {};
    cardPickState = null;

    const seeded = teams.map((t, i) => ({
      idx: i,
      combinedRank: (rankMap[t.players[0]] || 99) + (rankMap[t.players[1]] || 99)
    }));
    seeded.sort((a, b) => a.combinedRank - b.combinedRank);

    semiTeams = [seeded[0].idx, seeded[3].idx, seeded[1].idx, seeded[2].idx];
    semiWinners = [null, null];
    finalWinner = null;
    finalLoser = null;

    const el = document.getElementById("knockoutBanner");
    if (el) el.remove();

    renderSemis(false);
    showStep($stepSemis);
  }

  // ── Matchup Generation (Fixed mode Phase 1) ───────────────

  function generateAllPairs(n) {
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
    return pairs;
  }

  function circleMethodRounds(n) {
    const isOdd = n % 2 !== 0, effective = isOdd ? n + 1 : n, BYE = isOdd ? n : -1;
    const rounds = [], slots = [];
    for (let i = 1; i < effective; i++) slots.push(i);
    for (let r = 0; r < effective - 1; r++) {
      const rp = [], bottom = slots[slots.length - 1];
      if (0 !== BYE && bottom !== BYE) rp.push([0, bottom]);
      for (let i = 0; i < (effective / 2) - 1; i++) { const a = slots[i], b = slots[slots.length - 2 - i]; if (a !== BYE && b !== BYE) rp.push([a, b]); }
      rounds.push(rp); slots.unshift(slots.pop());
    }
    return rounds;
  }

  function generateMatchups(numTeams, mode, gpt) {
    if (mode === "roundrobin") return { matchups: generateAllPairs(numTeams), gamesPerTeam: numTeams - 1 };
    const allRounds = circleMethodRounds(numTeams), matchups = [], gc = new Array(numTeams).fill(0), used = new Set();
    for (const round of allRounds) { if (gc.every(g => g >= gpt)) break;
      for (const [a, b] of fisherYatesShuffle(round)) { if (gc[a] >= gpt || gc[b] >= gpt) continue; const k = a < b ? `${a}-${b}` : `${b}-${a}`; if (used.has(k)) continue; used.add(k); matchups.push([a, b]); gc[a]++; gc[b]++; }
    }
    if (!gc.every(g => g >= gpt)) {
      for (const [a, b] of fisherYatesShuffle(generateAllPairs(numTeams).filter(([a, b]) => !used.has(`${a}-${b}`)))) {
        if (gc[a] >= gpt && gc[b] >= gpt) continue; if (gc[a] >= gpt || gc[b] >= gpt) continue;
        used.add(`${a}-${b}`); matchups.push([a, b]); gc[a]++; gc[b]++; if (gc.every(g => g >= gpt)) break;
      }
    }
    return { matchups, gamesPerTeam: gpt };
  }

  // ── Schedule Generation (Fixed mode Phase 2) ──────────────

  function trailingCount(history, value) {
    let c = 0; for (let i = history.length - 1; i >= 0; i--) { if (history[i] === value) c++; else break; } return c;
  }

  function scheduleMatchups(matchupList, numTeams, numCourts) {
    const pool = matchupList.map(([a, b]) => [a, b]), history = Array.from({ length: numTeams }, () => []), sched = [];
    for (let iter = 0; iter < 500 && pool.length > 0; iter++) {
      const mustRestSet = new Set(), mustPlaySet = new Set();
      for (let t = 0; t < numTeams; t++) { const ps = trailingCount(history[t], "play"), rs = trailingCount(history[t], "rest"); if (ps >= MAX_CONSECUTIVE_PLAY) mustRestSet.add(t); else if (rs >= MAX_CONSECUTIVE_REST) mustPlaySet.add(t); }
      const roundGames = [], playing = new Set(), prio = [], norm = [];
      for (let i = 0; i < pool.length; i++) { const [a, b] = pool[i]; if (mustRestSet.has(a) || mustRestSet.has(b)) continue; if (mustPlaySet.has(a) || mustPlaySet.has(b)) prio.push(i); else norm.push(i); }
      let order = [...fisherYatesShuffle(prio), ...fisherYatesShuffle(norm)];
      if (order.length === 0 && mustPlaySet.size > 0) { for (let i = 0; i < pool.length; i++) { const [a, b] = pool[i]; if ((!mustRestSet.has(a) || mustPlaySet.has(a)) && (!mustRestSet.has(b) || mustPlaySet.has(b))) order.push(i); } order = fisherYatesShuffle(order); }
      const usedIdx = new Set();
      for (const idx of order) { if (roundGames.length >= numCourts) break; const [a, b] = pool[idx]; if (playing.has(a) || playing.has(b)) continue; roundGames.push([a, b]); playing.add(a); playing.add(b); usedIdx.add(idx); }
      if (roundGames.length === 0) { for (let t = 0; t < numTeams; t++) history[t].push("rest"); continue; }
      for (const idx of [...usedIdx].sort((a, b) => b - a)) pool.splice(idx, 1);
      sched.push(roundGames);
      for (let t = 0; t < numTeams; t++) history[t].push(playing.has(t) ? "play" : "rest");
    }
    return sched;
  }

  function countConstraintViolations(sched, numTeams) {
    const hist = Array.from({ length: numTeams }, () => []);
    for (const rd of sched) { const p = new Set(rd.flat()); for (let t = 0; t < numTeams; t++) hist[t].push(p.has(t) ? 1 : 0); }
    let v = 0;
    for (let t = 0; t < numTeams; t++) { const h = hist[t]; for (let i = 0, len = h.length - 2; i < len; i++) { const s = h[i] + h[i+1] + h[i+2]; if (s === 3 || s === 0) v++; } }
    return v;
  }

  function generateValidSchedule(teamList, numCourts, mode, gpt) {
    let best = null, bestScore = Infinity, bestGpt = gpt;
    for (let att = 0; att < MAX_SCHEDULE_ATTEMPTS; att++) {
      const { matchups, gamesPerTeam: actualGpt } = generateMatchups(teamList.length, mode, gpt);
      const sched = scheduleMatchups(fisherYatesShuffle(matchups), teamList.length, numCourts);
      const remaining = matchups.length - sched.reduce((s, r) => s + r.length, 0);
      const score = remaining * 1000 + countConstraintViolations(sched, teamList.length);
      if (score === 0) return { schedule: sched, gamesPerTeam: actualGpt };
      if (score < bestScore) { bestScore = score; best = sched; bestGpt = actualGpt; }
    }
    return { schedule: best, gamesPerTeam: bestGpt };
  }

  // ══════════════════════════════════════════════════════════
  // ── Flexible Schedule Generation ─────────────────────────
  // ══════════════════════════════════════════════════════════

  function tryFlexSchedule(players, numCourts, targetGpp) {
    const usedPartners = {};
    const gp = {};
    const hist = {};
    let remaining = players.length;
    players.forEach(p => { usedPartners[p] = new Set(); gp[p] = 0; hist[p] = []; });

    const sched = [];

    for (let iter = 0; iter < 500; iter++) {
      if (remaining === 0) break;

      const mustRest = new Set(), mustPlay = new Set();
      players.forEach(p => {
        if (gp[p] >= targetGpp) { mustRest.add(p); return; }
        const ps = trailingCount(hist[p], "play"), rs = trailingCount(hist[p], "rest");
        if (ps >= MAX_CONSECUTIVE_PLAY) mustRest.add(p);
        else if (rs >= MAX_CONSECUTIVE_REST) mustPlay.add(p);
      });

      const eligible = players.filter(p => !mustRest.has(p) && gp[p] < targetGpp);

      if (eligible.length < 4) {
        players.forEach(p => hist[p].push("rest"));
        continue;
      }

      const validPairs = [];
      for (let i = 0; i < eligible.length; i++) {
        for (let j = i + 1; j < eligible.length; j++) {
          if (!usedPartners[eligible[i]].has(eligible[j])) {
            validPairs.push([eligible[i], eligible[j], mustPlay.has(eligible[i]) || mustPlay.has(eligible[j])]);
          }
        }
      }

      const prioPairs = fisherYatesShuffle(validPairs.filter(p => p[2]));
      const normPairs = fisherYatesShuffle(validPairs.filter(p => !p[2]));
      const allPairs = [...prioPairs, ...normPairs];

      const roundMatches = [];
      const usedInRound = new Set();

      for (let court = 0; court < numCourts; court++) {
        let found = false;
        for (let i = 0; i < allPairs.length && !found; i++) {
          const [a1, a2] = allPairs[i];
          if (usedInRound.has(a1) || usedInRound.has(a2)) continue;
          for (let j = i + 1; j < allPairs.length; j++) {
            const [b1, b2] = allPairs[j];
            if (usedInRound.has(b1) || usedInRound.has(b2)) continue;
            if (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) continue;
            roundMatches.push({ teamA: [a1, a2], teamB: [b1, b2] });
            [a1, a2, b1, b2].forEach(p => usedInRound.add(p));
            found = true;
            break;
          }
        }
      }

      if (roundMatches.length === 0) {
        players.forEach(p => hist[p].push("rest"));
        continue;
      }

      roundMatches.forEach(m => {
        usedPartners[m.teamA[0]].add(m.teamA[1]);
        usedPartners[m.teamA[1]].add(m.teamA[0]);
        usedPartners[m.teamB[0]].add(m.teamB[1]);
        usedPartners[m.teamB[1]].add(m.teamB[0]);
        m.teamA.forEach(p => { if (++gp[p] === targetGpp) remaining--; });
        m.teamB.forEach(p => { if (++gp[p] === targetGpp) remaining--; });
      });

      sched.push(roundMatches);
      players.forEach(p => hist[p].push(usedInRound.has(p) ? "play" : "rest"));
    }

    return { schedule: sched, gamesPlayed: gp };
  }

  function countFlexViolations(sched, players) {
    const hist = {};
    players.forEach(p => hist[p] = []);
    for (const rd of sched) {
      const playing = new Set();
      rd.forEach(m => { m.teamA.forEach(p => playing.add(p)); m.teamB.forEach(p => playing.add(p)); });
      players.forEach(p => hist[p].push(playing.has(p) ? 1 : 0));
    }
    let v = 0;
    players.forEach(p => { const h = hist[p]; for (let i = 0, len = h.length - 2; i < len; i++) { const s = h[i] + h[i+1] + h[i+2]; if (s === 3 || s === 0) v++; } });
    return v;
  }

  function hasPartnerRepeats(sched) {
    const used = new Set();
    for (const rd of sched) {
      for (const m of rd) {
        const k1 = pairKey(m.teamA[0], m.teamA[1]);
        if (used.has(k1)) return true; used.add(k1);
        const k2 = pairKey(m.teamB[0], m.teamB[1]);
        if (used.has(k2)) return true; used.add(k2);
      }
    }
    return false;
  }

  function generateFlexibleSchedule(players, numCourts, targetGpp) {
    let bestSchedule = null, bestScore = Infinity;
    for (let att = 0; att < FLEX_SCHEDULE_ATTEMPTS; att++) {
      const result = tryFlexSchedule(players, numCourts, targetGpp);
      let shortfall = 0;
      players.forEach(p => { const d = targetGpp - result.gamesPlayed[p]; if (d > 0) shortfall += d; });
      const violations = countFlexViolations(result.schedule, players);
      const repeats = hasPartnerRepeats(result.schedule) ? 10000 : 0;
      const score = shortfall * 1000 + violations + repeats;
      if (score === 0) return result.schedule;
      if (score < bestScore) { bestScore = score; bestSchedule = result.schedule; }
    }
    return bestSchedule;
  }

  // ── Fixed League Rendering ────────────────────────────────

  function renderTeams() {
    $teamsList.innerHTML = "";
    teams.forEach((team, i) => {
      const badge = document.createElement("div");
      badge.className = `team-badge team-color-${i % 24}`;
      if (unavailableSet.has(i)) badge.classList.add("badge-unavailable");
      badge.dataset.teamIdx = i;

      const label = document.createElement("span");
      label.className = "badge-label";
      label.textContent = `${team.label}: ${team.players[0]} & ${team.players[1]}`;
      badge.appendChild(label);

      const tog = document.createElement("button");
      tog.className = "badge-toggle";
      tog.textContent = unavailableSet.has(i) ? "\u25B6" : "\u23F8";
      tog.title = unavailableSet.has(i) ? "Mark available" : "Mark away";
      tog.addEventListener("click", (e) => { e.stopPropagation(); toggleAvailability(i); });
      badge.appendChild(tog);

      badge.addEventListener("click", () => toggleFilter("team", i));
      $teamsList.appendChild(badge);
    });
  }

  function renderFixedLeaderboardHeader() {
    $leaderboardHead.innerHTML = `<tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>+/&minus;</th></tr>`;
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
      tdRound.className = "round-label"; tdRound.textContent = `R${rIdx + 1}`; tr.appendChild(tdRound);
      for (let c = 0; c < currentCourts; c++) {
        const td = document.createElement("td");
        if (c < roundGames.length) {
          const [a, b] = roundGames[c], winner = matchResults[rIdx][c], scores = matchScores[rIdx] ? matchScores[rIdx][c] : null;
          let scoreHtml = "";
          if (winner !== null) {
            const aS = (scores && scores[0] != null) ? scores[0] : "", bS = (scores && scores[1] != null) ? scores[1] : "";
            const aL = teams[a].label.replace("Team ", "T"), bL = teams[b].label.replace("Team ", "T");
            scoreHtml = `<div class="score-row"><span class="score-team-label">${aL}</span><input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="a" value="${aS}" placeholder="\u2014" min="0" inputmode="numeric" /><span class="score-dash">\u2013</span><input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="b" value="${bS}" placeholder="\u2014" min="0" inputmode="numeric" /><span class="score-team-label">${bL}</span></div>`;
          }
          td.innerHTML = `<div class="match-cell"><div class="match-teams-row"><button class="team-btn team-color-${a % 24} ${winner === a ? 'winner' : (winner !== null ? 'loser' : '')}" data-round="${rIdx}" data-court="${c}" data-team="${a}">${teams[a].label}</button><span class="vs-label">vs</span><button class="team-btn team-color-${b % 24} ${winner === b ? 'winner' : (winner !== null ? 'loser' : '')}" data-round="${rIdx}" data-court="${c}" data-team="${b}">${teams[b].label}</button></div>${scoreHtml}</div>`;
        } else { td.textContent = "\u2014"; td.style.color = "#aaa"; }
        tr.appendChild(td);
      }
      $schedBody.appendChild(tr);
    });
  }

  function getLeaderboard() {
    const stats = teams.map((t, i) => ({ idx: i, played: 0, won: 0, lost: 0, diff: 0 }));
    for (let r = 0; r < schedule.length; r++) {
      for (let c = 0; c < schedule[r].length; c++) {
        const [a, b] = schedule[r][c], w = matchResults[r][c];
        if (w !== null) {
          const loser = w === a ? b : a;
          stats[a].played++; stats[b].played++; stats[w].won++; stats[loser].lost++;
          const sc = matchScores[r] ? matchScores[r][c] : null;
          if (sc && sc[0] != null && sc[1] != null && !isNaN(sc[0]) && !isNaN(sc[1])) {
            const d = ((w === a) ? sc[0] : sc[1]) - ((w === a) ? sc[1] : sc[0]);
            stats[w].diff += d; stats[loser].diff -= d;
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
      tr.innerHTML = `<td>${rank + 1}</td><td>${teamSpan(s.idx)}</td><td>${s.played}</td><td>${s.won}</td><td>${s.lost}</td><td><strong>${s.won}</strong></td><td class="${diffCls}"><strong>${diffStr}</strong></td>`;
      $leaderboardBody.appendChild(tr);
    });
  }

  function updateLeagueProgress() {
    let total = 0, done = 0;
    for (let r = 0; r < schedule.length; r++) for (let c = 0; c < schedule[r].length; c++) { total++; if (matchResults[r][c] !== null) done++; }
    $leagueProgress.textContent = `${done} / ${total} matches recorded`;
    btnToSemis.disabled = (done < total);
  }

  function handleMatchClick(e) {
    const btn = e.target.closest(".team-btn");
    if (!btn) return;
    const r = parseInt(btn.dataset.round), c = parseInt(btn.dataset.court), t = parseInt(btn.dataset.team);
    matchResults[r][c] = (matchResults[r][c] === t) ? null : t;
    if (matchResults[r][c] === null) matchScores[r][c] = null;
    renderScheduleWithButtons(); renderLeaderboard(); updateLeagueProgress(); applyFilter(); applyUnavailableOverlay(); saveState();
  }

  function handleScoreInput(e) {
    const inp = e.target.closest(".score-input"); if (!inp) return;
    const r = parseInt(inp.dataset.round), c = parseInt(inp.dataset.court), side = inp.dataset.side;
    if (!matchScores[r]) matchScores[r] = schedule[r].map(() => null);
    if (!matchScores[r][c]) matchScores[r][c] = [null, null];
    const parsed = parseInt(inp.value, 10);
    const val = (inp.value === "" || isNaN(parsed)) ? null : parsed;
    if (side === "a") matchScores[r][c][0] = val; else matchScores[r][c][1] = val;
    renderLeaderboard(); saveState();
  }

  // ── Flexible League Rendering ─────────────────────────────

  function renderFlexPlayers() {
    $teamsList.innerHTML = "";
    currentPlayers.forEach((name, i) => {
      const badge = document.createElement("div");
      badge.className = `team-badge team-color-${i % 24}`;
      if (unavailableSet.has(name)) badge.classList.add("badge-unavailable");
      badge.dataset.playerName = name;

      const label = document.createElement("span");
      label.className = "badge-label";
      label.textContent = name;
      badge.appendChild(label);

      const tog = document.createElement("button");
      tog.className = "badge-toggle";
      tog.textContent = unavailableSet.has(name) ? "\u25B6" : "\u23F8";
      tog.title = unavailableSet.has(name) ? "Mark available" : "Mark away";
      tog.addEventListener("click", (e) => { e.stopPropagation(); toggleAvailability(name); });
      badge.appendChild(tog);

      badge.addEventListener("click", () => toggleFilter("player", name));
      $teamsList.appendChild(badge);
    });
  }

  function renderFlexLeaderboardHeader() {
    $leaderboardHead.innerHTML = `<tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>+/&minus;</th></tr>`;
  }

  function renderFlexSchedule() {
    $schedHead.innerHTML = "";
    const headRow = document.createElement("tr");
    headRow.innerHTML = `<th>Round</th>`;
    for (let c = 0; c < currentCourts; c++) headRow.innerHTML += `<th>Court ${c + 1}</th>`;
    $schedHead.appendChild(headRow);

    $schedBody.innerHTML = "";
    flexSchedule.forEach((roundMatches, rIdx) => {
      const tr = document.createElement("tr");
      const tdRound = document.createElement("td");
      tdRound.className = "round-label"; tdRound.textContent = `R${rIdx + 1}`; tr.appendChild(tdRound);

      for (let c = 0; c < currentCourts; c++) {
        const td = document.createElement("td");
        if (c < roundMatches.length) {
          const m = roundMatches[c];
          const result = flexMatchResults[rIdx] ? flexMatchResults[rIdx][c] : null;
          const scores = flexMatchScores[rIdx] ? flexMatchScores[rIdx][c] : null;

          const aLabel = m.teamA.map(n => n.split(" ")[0]).join(" & ");
          const bLabel = m.teamB.map(n => n.split(" ")[0]).join(" & ");

          let scoreHtml = "";
          if (result !== null) {
            const aS = (scores && scores[0] != null) ? scores[0] : "";
            const bS = (scores && scores[1] != null) ? scores[1] : "";
            scoreHtml = `<div class="score-row"><input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="a" value="${aS}" placeholder="\u2014" min="0" inputmode="numeric" /><span class="score-dash">\u2013</span><input type="number" class="score-input" data-round="${rIdx}" data-court="${c}" data-side="b" value="${bS}" placeholder="\u2014" min="0" inputmode="numeric" /></div>`;
          }

          td.innerHTML = `<div class="match-cell"><div class="match-teams-row"><button class="flex-match-btn ${result === 'a' ? 'winner' : (result !== null ? 'loser' : '')}" data-round="${rIdx}" data-court="${c}" data-side="a" title="${m.teamA.join(' & ')}">${aLabel}</button><span class="vs-label">vs</span><button class="flex-match-btn ${result === 'b' ? 'winner' : (result !== null ? 'loser' : '')}" data-round="${rIdx}" data-court="${c}" data-side="b" title="${m.teamB.join(' & ')}">${bLabel}</button></div>${scoreHtml}</div>`;
        } else { td.textContent = "\u2014"; td.style.color = "#aaa"; }
        tr.appendChild(td);
      }
      $schedBody.appendChild(tr);
    });
  }

  function getFlexLeaderboard() {
    const statsMap = {};
    currentPlayers.forEach((p, i) => { statsMap[p] = { name: p, idx: i, played: 0, won: 0, lost: 0, diff: 0 }; });

    for (let r = 0; r < flexSchedule.length; r++) {
      for (let c = 0; c < flexSchedule[r].length; c++) {
        const m = flexSchedule[r][c], result = flexMatchResults[r] ? flexMatchResults[r][c] : null;
        if (result === null) continue;
        const winners = result === "a" ? m.teamA : m.teamB;
        const losers  = result === "a" ? m.teamB : m.teamA;
        winners.forEach(p => { statsMap[p].played++; statsMap[p].won++; });
        losers.forEach(p =>  { statsMap[p].played++; statsMap[p].lost++; });

        const sc = flexMatchScores[r] ? flexMatchScores[r][c] : null;
        if (sc && sc[0] != null && sc[1] != null && !isNaN(sc[0]) && !isNaN(sc[1])) {
          const wScore = result === "a" ? sc[0] : sc[1];
          const lScore = result === "a" ? sc[1] : sc[0];
          const d = wScore - lScore;
          winners.forEach(p => statsMap[p].diff += d);
          losers.forEach(p =>  statsMap[p].diff -= d);
        }
      }
    }

    const stats = Object.values(statsMap);
    stats.sort((a, b) => b.won - a.won || b.diff - a.diff || a.lost - b.lost || a.idx - b.idx);
    return stats;
  }

  function renderFlexLeaderboard() {
    const stats = getFlexLeaderboard();
    $leaderboardBody.innerHTML = "";
    stats.forEach((s, rank) => {
      const tr = document.createElement("tr");
      const diffStr = s.diff > 0 ? `+${s.diff}` : `${s.diff}`;
      const diffCls = s.diff > 0 ? "diff-pos" : (s.diff < 0 ? "diff-neg" : "");
      const colorIdx = s.idx % 24;
      tr.innerHTML = `<td>${rank + 1}</td><td><span class="team-color-${colorIdx}" style="padding:2px 6px;border-radius:4px;">${s.name}</span></td><td>${s.played}</td><td>${s.won}</td><td>${s.lost}</td><td><strong>${s.won}</strong></td><td class="${diffCls}"><strong>${diffStr}</strong></td>`;
      $leaderboardBody.appendChild(tr);
    });
  }

  function updateFlexProgress() {
    let total = 0, done = 0;
    for (let r = 0; r < flexSchedule.length; r++) for (let c = 0; c < flexSchedule[r].length; c++) { total++; if (flexMatchResults[r] && flexMatchResults[r][c] !== null) done++; }
    $leagueProgress.textContent = `${done} / ${total} matches recorded`;
    if (currentPlayers.length >= 8) btnToSemis.disabled = (done < total);
  }

  function handleFlexMatchClick(e) {
    const btn = e.target.closest(".flex-match-btn"); if (!btn) return;
    const r = parseInt(btn.dataset.round), c = parseInt(btn.dataset.court), side = btn.dataset.side;
    if (!flexMatchResults[r]) flexMatchResults[r] = flexSchedule[r].map(() => null);
    const prev = flexMatchResults[r][c];
    flexMatchResults[r][c] = (prev === side) ? null : side;
    if (flexMatchResults[r][c] === null && flexMatchScores[r]) flexMatchScores[r][c] = null;
    renderFlexSchedule(); renderFlexLeaderboard(); updateFlexProgress(); applyFilter(); applyUnavailableOverlay(); saveState();
  }

  function handleFlexScoreInput(e) {
    const inp = e.target.closest(".score-input"); if (!inp) return;
    if (tournamentFormat !== "flexible") return;
    const r = parseInt(inp.dataset.round), c = parseInt(inp.dataset.court), side = inp.dataset.side;
    if (!flexMatchScores[r]) flexMatchScores[r] = flexSchedule[r].map(() => null);
    if (!flexMatchScores[r][c]) flexMatchScores[r][c] = [null, null];
    const parsed = parseInt(inp.value, 10);
    const val = (inp.value === "" || isNaN(parsed)) ? null : parsed;
    if (side === "a") flexMatchScores[r][c][0] = val; else flexMatchScores[r][c][1] = val;
    renderFlexLeaderboard(); saveState();
  }

  // ── Semi-Finals (Fixed mode only) ─────────────────────────

  function is3TeamMode() { return teams.length === 3; }

  function renderSemis(fromSaved) {
    if (is3TeamMode()) renderSemis3(fromSaved); else renderSemis4(fromSaved);
  }

  function renderSemis3(fromSaved) {
    if (!fromSaved) { const lb = getLeaderboard(); semiTeams = [lb[0].idx, lb[1].idx, lb[2].idx]; semiWinners = [null]; }
    $semisInfo.innerHTML = `Table Topper: ${teamSpan(semiTeams[0])} advances directly to Final`;
    $semisMatches.innerHTML = "";
    const byeDiv = document.createElement("div"); byeDiv.className = "bye-banner";
    byeDiv.innerHTML = `${teamSpan(semiTeams[0])} (1st Place) \u2014 BYE to Final`; $semisMatches.appendChild(byeDiv);
    const a = semiTeams[1], b = semiTeams[2], div = document.createElement("div"); div.className = "knockout-match";
    div.innerHTML = `<div class="match-title">Semi-Final: 2nd vs 3rd</div><div class="match-teams"><button class="ko-team-btn team-color-${a % 24}" data-semi="0" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button><span class="ko-vs">VS</span><button class="ko-team-btn team-color-${b % 24}" data-semi="0" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button></div>`;
    $semisMatches.appendChild(div); btnToFinals.disabled = true; if (fromSaved) updateSemiUI();
  }

  function renderSemis4(fromSaved) {
    if (!fromSaved && tournamentFormat !== "flexible") { const lb = getLeaderboard(); semiTeams = [lb[0].idx, lb[3].idx, lb[1].idx, lb[2].idx]; semiWinners = [null, null]; }
    const infoPrefix = tournamentFormat === "flexible" ? "Knockout Teams (seeded by league rank): " : "Top 4: ";
    $semisInfo.innerHTML = `${infoPrefix}${teamSpan(semiTeams[0])}, ${teamSpan(semiTeams[2])}, ${teamSpan(semiTeams[3])}, ${teamSpan(semiTeams[1])}`;
    $semisMatches.innerHTML = "";
    for (let m = 0; m < 2; m++) {
      const a = semiTeams[m*2], b = semiTeams[m*2+1], seedA = m === 0 ? "Seed 1" : "Seed 2", seedB = m === 0 ? "Seed 4" : "Seed 3";
      const div = document.createElement("div"); div.className = "knockout-match";
      div.innerHTML = `<div class="match-title">Semi-Final ${m+1}: ${seedA} vs ${seedB}</div><div class="match-teams"><button class="ko-team-btn team-color-${a % 24}" data-semi="${m}" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button><span class="ko-vs">VS</span><button class="ko-team-btn team-color-${b % 24}" data-semi="${m}" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button></div>`;
      $semisMatches.appendChild(div);
    }
    btnToFinals.disabled = true; if (fromSaved) updateSemiUI();
  }

  function handleSemiClick(e) {
    const btn = e.target.closest(".ko-team-btn"); if (!btn || btn.dataset.semi === undefined) return;
    const m = parseInt(btn.dataset.semi), t = parseInt(btn.dataset.team);
    semiWinners[m] = (semiWinners[m] === t) ? null : t; updateSemiUI(); saveState();
  }

  function updateSemiUI() {
    $semisMatches.querySelectorAll(".ko-team-btn").forEach(btn => {
      const m = parseInt(btn.dataset.semi), t = parseInt(btn.dataset.team);
      btn.classList.toggle("winner", semiWinners[m] === t);
      btn.classList.toggle("loser", semiWinners[m] !== null && semiWinners[m] !== t);
    });
    btnToFinals.disabled = semiWinners.includes(null);
  }

  // ── Finals (Fixed mode only) ──────────────────────────────

  function renderFinals(fromSaved) {
    if (!fromSaved) { finalWinner = null; finalLoser = null; }
    let a, b;
    if (is3TeamMode()) { a = semiTeams[0]; b = semiWinners[0]; } else { a = semiWinners[0]; b = semiWinners[1]; }
    $finalsMatch.innerHTML = "";
    const div = document.createElement("div"); div.className = "knockout-match";
    const te = is3TeamMode() ? " (Table Topper vs Semi Winner)" : "";
    div.innerHTML = `<div class="match-title">FINAL${te}</div><div class="match-teams"><button class="ko-team-btn team-color-${a % 24}" data-final="1" data-team="${a}">${teams[a].label}<br><small>${teams[a].players.join(" & ")}</small></button><span class="ko-vs">VS</span><button class="ko-team-btn team-color-${b % 24}" data-final="1" data-team="${b}">${teams[b].label}<br><small>${teams[b].players.join(" & ")}</small></button></div>`;
    $finalsMatch.appendChild(div); btnToSummary.disabled = true; if (fromSaved) updateFinalUI();
  }

  function handleFinalClick(e) {
    const btn = e.target.closest(".ko-team-btn"); if (!btn || !btn.dataset.final) return;
    const t = parseInt(btn.dataset.team);
    let a, b;
    if (is3TeamMode()) { a = semiTeams[0]; b = semiWinners[0]; } else { a = semiWinners[0]; b = semiWinners[1]; }
    if (finalWinner === t) { finalWinner = null; finalLoser = null; } else { finalWinner = t; finalLoser = (t === a) ? b : a; }
    updateFinalUI(); saveState();
  }

  function updateFinalUI() {
    $finalsMatch.querySelectorAll(".ko-team-btn").forEach(btn => {
      const t = parseInt(btn.dataset.team);
      btn.classList.toggle("winner", finalWinner === t);
      btn.classList.toggle("loser", finalWinner !== null && finalWinner !== t);
    });
    btnToSummary.disabled = (finalWinner === null);
  }

  // ── Final Summary & Cost (Fixed mode only) ────────────────

  function renderSummary() {
    $finalStandings.innerHTML = "";
    const items = [
      { rank: "\uD83C\uDFC6", label: "Champions", teamIdx: finalWinner, cls: "gold" },
      { rank: "\uD83E\uDD48", label: "Runners-up", teamIdx: finalLoser, cls: "silver" }
    ];
    items.forEach(item => {
      const t = teams[item.teamIdx], div = document.createElement("div"); div.className = `standing-item ${item.cls}`;
      const teamLabel = tournamentFormat === "flexible"
        ? `<strong>${t.players.join(" & ")}</strong>`
        : `<strong>${t.label}</strong> \u2014 ${t.players.join(" & ")}`;
      div.innerHTML = `<span class="standing-rank">${item.rank}</span><span>${item.label}: ${teamLabel}</span>`;
      $finalStandings.appendChild(div);
    });
    $costResultsSection.hidden = true;
  }

  function calculateCost() {
    const totalCost = (parseFloat($courtCost.value) || 0) + (parseFloat($shuttleCost.value) || 0);
    const x = totalCost / (currentPlayers.length - 3), halfX = x / 2;
    const winnerSet = new Set(teams[finalWinner].players), loserSet = new Set(teams[finalLoser].players);
    $costSummaryInfo.innerHTML = `Total: <strong>${totalCost.toFixed(2)}</strong> | Normal: <strong>${x.toFixed(2)}</strong> | Runner: <strong>${halfX.toFixed(2)}</strong> | Winner: <strong>0.00</strong>`;
    $costBody.innerHTML = ""; let checkSum = 0;
    currentPlayers.forEach(player => {
      const tr = document.createElement("tr"); let standing, amount, cls;
      const playerTeam = teams.find(t => t.players.includes(player));
      if (winnerSet.has(player)) { standing = "\uD83C\uDFC6 Champion"; amount = 0; cls = "pay-zero"; }
      else if (loserSet.has(player)) { standing = "\uD83E\uDD48 Runner-up"; amount = halfX; cls = "pay-half"; }
      else { standing = "\u2014"; amount = x; cls = "pay-full"; }
      checkSum += amount;
      tr.innerHTML = `<td style="text-align:left;font-weight:500">${player}</td><td>${playerTeam ? playerTeam.label : '\u2014'}</td><td>${standing}</td><td class="${cls}">${amount.toFixed(2)}</td>`;
      $costBody.appendChild(tr);
    });
    $costTotal.innerHTML = `Total collected: <strong>${checkSum.toFixed(2)}</strong> / ${totalCost.toFixed(2)}`;
    $costResultsSection.hidden = false;
  }

  // ── Start League Phase ────────────────────────────────────

  function startFixedLeaguePhase() {
    tournamentFormat = "fixed";
    gameMode = getSelectedGameMode();
    const gpt = (gameMode === "roundrobin") ? teams.length - 1 : parseInt($numGamesPerTeam.value, 10);
    const result = generateValidSchedule(teams, currentCourts, gameMode, gpt);
    schedule = result.schedule; gamesPerTeam = result.gamesPerTeam;
    matchResults = schedule.map(r => r.map(() => null));
    matchScores  = schedule.map(r => r.map(() => null));

    const modeLabel = gameMode === "roundrobin" ? "Full Round-Robin" : `${gamesPerTeam} games/team`;
    $gamesInfo.textContent = `${teams.length} teams, ${currentCourts} court(s), ${modeLabel}`;
    $teamsHeader.innerHTML = "&#129309; Teams";
    clearFilter(); unavailableSet.clear();
    renderTeams(); renderFixedLeaderboardHeader(); renderScheduleWithButtons(); renderLeaderboard(); updateLeagueProgress();
    btnToSemis.style.display = ""; btnLeagueReRandom.style.display = "";
    showStep($stepLeague);
  }

  function startFlexLeaguePhase() {
    tournamentFormat = "flexible";
    gameMode = getSelectedGameMode();
    const targetGpp = (gameMode === "roundrobin") ? currentPlayers.length - 1 : parseInt($numGamesPerTeam.value, 10);
    flexSchedule = generateFlexibleSchedule(currentPlayers, currentCourts, targetGpp);
    flexMatchResults = flexSchedule.map(r => r.map(() => null));
    flexMatchScores  = flexSchedule.map(r => r.map(() => null));
    gamesPerPlayer = targetGpp;

    const modeLabel = gameMode === "roundrobin" ? "Max Games" : `${gamesPerPlayer} games/player`;
    $gamesInfo.textContent = `${currentPlayers.length} players, ${currentCourts} court(s), Flexible, ${modeLabel}`;
    $teamsHeader.innerHTML = "&#127919; Players";
    clearFilter(); unavailableSet.clear();
    renderFlexPlayers(); renderFlexLeaderboardHeader(); renderFlexSchedule(); renderFlexLeaderboard(); updateFlexProgress();
    if (currentPlayers.length >= 8) {
      btnToSemis.style.display = "";
      btnToSemis.innerHTML = "Knockout Card Pick &rarr;";
    } else {
      btnToSemis.style.display = "none";
    }
    btnLeagueReRandom.style.display = "";
    showStep($stepLeague);
  }

  function handleGenerate() {
    clearError($namesError);
    const result = gatherNames();
    if (result.error) { showError($namesError, result.error); return; }
    currentPlayers = result.names;
    tournamentFormat = getSelectedFormat();

    if (tournamentFormat === "flexible") {
      startFlexLeaguePhase();
      return;
    }

    teamMode = getSelectedTeamMode();
    if (teamMode === "fixed") {
      const ft = gatherFixedTeams();
      if (ft.errors.length) { showError($namesError, ft.errors[0]); return; }
      if (ft.assigned.size < currentPlayers.length) { showError($namesError, `All ${currentPlayers.length} players must be assigned. ${currentPlayers.length - ft.assigned.size} unassigned.`); return; }
      teams = buildTeamsFromPairs(ft.fixed);
      startFixedLeaguePhase();
    } else if (teamMode === "mixed") {
      const ft = gatherFixedTeams();
      if (ft.errors.length) { showError($namesError, ft.errors[0]); return; }
      const unassigned = currentPlayers.filter(n => !ft.assigned.has(n));
      if (unassigned.length === 0) { teams = buildTeamsFromPairs(ft.fixed); startFixedLeaguePhase(); }
      else if (unassigned.length % 2 !== 0) { showError($namesError, `${unassigned.length} unassigned (odd). Need even number.`); return; }
      else { initCardPick(unassigned, ft.fixed); showStep($stepCardpick); }
    } else {
      initCardPick(currentPlayers, []); showStep($stepCardpick);
    }
  }

  // ── Event Listeners ───────────────────────────────────────

  $tournamentFormatGroup.addEventListener("change", () => { updateFormatVisibility(); });
  $gameModeGroup.addEventListener("change", updateGptVisibility);
  $teamModeGroup.addEventListener("change", updateTeamModeVisibility);

  $numPlayers.addEventListener("input", () => {
    const n = parseInt($numPlayers.value, 10), fmt = getSelectedFormat();
    if (isNaN(n) || n < 4) return;
    if (fmt === "flexible") {
      const maxG = n - 1;
      $gptHint.textContent = `1 to ${maxG} games, no repeat partners`;
      if (parseInt($numGamesPerTeam.value, 10) > maxG) $numGamesPerTeam.value = maxG;
    } else if (n >= 6 && n % 2 === 0) {
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
    fixedPairs = []; pendingPick = null;

    const fmt = getSelectedFormat();
    if (fmt === "flexible") {
      $teamModeSection.style.display = "none";
      $fixedTeamsArea.hidden = true;
    } else {
      $teamModeSection.style.display = "";
      updateTeamModeVisibility();
    }
    showStep($stepNames);
  });

  btnBack.addEventListener("click", () => { clearError($namesError); showStep($stepSetup); });
  btnGenerate.addEventListener("click", handleGenerate);

  $fixedChipsPool.addEventListener("click", (e) => {
    const chip = e.target.closest(".player-chip"); if (chip) handleChipClick(chip.dataset.name);
  });
  $fixedPairsDone.addEventListener("click", (e) => {
    const btn = e.target.closest(".fixed-pair-remove"); if (btn) removeFixedPair(parseInt(btn.dataset.pair, 10));
  });

  btnBackToNames.addEventListener("click", () => {
    const wasKnockout = cardPickState && cardPickState.purpose === "knockout";
    cardPickState = null;
    const el = document.getElementById("knockoutBanner");
    if (el) el.remove();
    if (wasKnockout) {
      currentStep = "league";
      showStep($stepLeague);
    } else {
      buildNameFields(currentPlayers.length);
      const inputs = $nameFields.querySelectorAll("input");
      currentPlayers.forEach((name, i) => { if (inputs[i]) inputs[i].value = name; });
      $teamModeSection.style.display = ""; updateTeamModeVisibility();
      showStep($stepNames);
    }
  });

  btnStartLeague.addEventListener("click", () => { finalizeTeamsFromCardPick(); });

  btnLeagueRestart.addEventListener("click", () => {
    if (!confirm("This will erase the current tournament. Are you sure?")) return;
    clearState(); showStep($stepSetup);
  });
  btnLeagueReRandom.addEventListener("click", () => {
    if (!confirm("Re-shuffle and erase match results?")) return;
    clearState();
    if (tournamentFormat === "flexible") startFlexLeaguePhase();
    else { teams = formTeams(currentPlayers); startFixedLeaguePhase(); }
  });

  $schedBody.addEventListener("click", (e) => {
    if (tournamentFormat === "flexible") handleFlexMatchClick(e); else handleMatchClick(e);
  });
  $schedBody.addEventListener("input", (e) => {
    if (tournamentFormat === "flexible") handleFlexScoreInput(e); else handleScoreInput(e);
  });

  btnToSemis.addEventListener("click", () => {
    if (tournamentFormat === "flexible") { startFlexKnockoutPick(); }
    else { renderSemis(); showStep($stepSemis); }
  });
  btnBackToLeague.addEventListener("click", () => showStep($stepLeague));
  $semisMatches.addEventListener("click", handleSemiClick);
  btnToFinals.addEventListener("click", () => { renderFinals(); showStep($stepFinals); });
  btnBackToSemis.addEventListener("click", () => showStep($stepSemis));
  $finalsMatch.addEventListener("click", handleFinalClick);
  btnToSummary.addEventListener("click", () => { renderSummary(); showStep($stepSummary); });
  btnCalcCost.addEventListener("click", calculateCost);
  btnSummaryRestart.addEventListener("click", () => {
    if (!confirm("Start a new tournament?")) return; clearState(); showStep($stepSetup);
  });
  btnPrint.addEventListener("click", () => window.print());

  // ── Startup ───────────────────────────────────────────────
  updateFormatVisibility();
  if (loadState()) restoreView();
})();
