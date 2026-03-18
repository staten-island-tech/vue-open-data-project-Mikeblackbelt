<script setup>
import { ref, onMounted, nextTick } from "vue"

const song = ref(null)
const challenger = ref(null)
const audioSrc = ref("")
const challengerAudioSrc = ref("")
const error = ref("")
const loading = ref(false)
const chartEl = ref(null)

const gameState = ref("playing") // "playing" | "correct" | "wrong"
const score = ref(0)
const streak = ref(0)

const GENRE_THEMES = {
  rock:       { bg: "bg-black",       bar1: "#e63030", bar2: "#3f3f3f", badge: "bg-red-600 text-white",          btn1: "bg-red-600 text-white",      btn2: "bg-zinc-800 text-zinc-400" },
  pop:        { bg: "bg-fuchsia-950", bar1: "#e040a0", bar2: "#4a1a3a", badge: "bg-pink-500 text-white",         btn1: "bg-pink-500 text-white",     btn2: "bg-fuchsia-900 text-fuchsia-300" },
  "hip-hop":  { bg: "bg-zinc-950",    bar1: "#b8ff3a", bar2: "#2a3a1a", badge: "bg-lime-400 text-black",         btn1: "bg-lime-400 text-black",     btn2: "bg-zinc-800 text-zinc-400" },
  electronic: { bg: "bg-slate-950",   bar1: "#00c8ff", bar2: "#002244", badge: "bg-cyan-400 text-black",         btn1: "bg-cyan-400 text-black",     btn2: "bg-slate-800 text-slate-400" },
  jazz:       { bg: "bg-amber-950",   bar1: "#f0a020", bar2: "#3a2500", badge: "bg-amber-400 text-black",        btn1: "bg-amber-400 text-black",    btn2: "bg-amber-900 text-amber-400" },
  default:    { bg: "bg-zinc-900",    bar1: "#888780", bar2: "#333",    badge: "bg-zinc-500 text-white",         btn1: "bg-zinc-500 text-white",     btn2: "bg-zinc-800 text-zinc-400" },
}

function getGenre(g) {
  if (!g) return "default"
  const s = g.toLowerCase()
  if (s.includes("rock") || s.includes("metal") || s.includes("punk")) return "rock"
  if (s.includes("pop")) return "pop"
  if (s.includes("hip") || s.includes("rap")) return "hip-hop"
  if (s.includes("electro") || s.includes("edm") || s.includes("dance")) return "electronic"
  if (s.includes("jazz") || s.includes("blues") || s.includes("soul")) return "jazz"
  return "default"
}

// Generate a random single letter or two-letter combo to use as search term
function randomQuery() {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  const len = Math.random() < 0.5 ? 1 : 2
  let q = ""
  for (let i = 0; i < len; i++) q += chars[Math.floor(Math.random() * chars.length)]
  return q
}

async function fetchPlaycount(artist, track) {
  try {
    const res = await fetch(
      `/api/lastfm?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.playcount ? parseInt(data.playcount) : null
  } catch {
    return null
  }
}

async function fetchRandomTrack() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const q = randomQuery()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) continue

      const data = await res.json()
      if (!data.results?.length) continue

      // Pick a random result from the returned list
      const pool = data.results.filter(r => r.previewUrl)
      if (!pool.length) continue

      const result = pool[Math.floor(Math.random() * pool.length)]
      const playcount = await fetchPlaycount(result.artistName, result.trackName)

      return {
        trackName: result.trackName,
        artistName: result.artistName,
        artworkUrl: result.artworkUrl100,
        previewUrl: result.previewUrl,
        genre: getGenre(result.primaryGenreName),
        playcount: playcount ?? 0,
      }
    } catch {
      continue
    }
  }
  return null
}

function renderChart(revealed = false) {
  if (!chartEl.value || !window.d3 || !song.value || !challenger.value) return
  chartEl.value.innerHTML = ""

  const theme = GENRE_THEMES[song.value.genre] || GENRE_THEMES.default
  const totalWidth = chartEl.value.clientWidth || 360
  const margin = { top: 24, right: 24, bottom: 52, left: 60 }
  const width = totalWidth - margin.left - margin.right
  const height = 300 - margin.top - margin.bottom

  const songK = Math.round((song.value.playcount || 0) / 1000)
  const chalK = Math.round((challenger.value.playcount || 0) / 1000)

  // Before reveal, show equal placeholder bars
  const displayA = revealed ? songK : 50
  const displayB = revealed ? chalK : 50
  const maxVal = revealed ? Math.max(songK, chalK, 1) * 1.3 : 80

  const data = [
    { label: song.value.trackName, value: displayA, color: theme.bar1, key: "song" },
    { label: challenger.value.trackName, value: displayB, color: theme.bar2, key: "challenger" },
  ]

  const svg = d3.select(chartEl.value)
    .append("svg")
    .attr("width", "100%")
    .attr("height", 300)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)

  const x = d3.scaleBand().domain(data.map(d => d.label)).range([0, width]).padding(0.4)
  const y = d3.scaleLinear().domain([0, maxVal]).range([height, 0])

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => g.select(".domain").attr("stroke", "rgba(255,255,255,0.08)"))
    .call(g => g.selectAll("text")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "12px")
      .attr("dy", "1.6em")
      .each(function() {
        const el = d3.select(this)
        const txt = el.text()
        if (txt.length > 16) el.text(txt.slice(0, 15) + "…")
      }))

  svg.append("g")
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => d + "k").tickSize(-width))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "rgba(255,255,255,0.06)")
      .attr("stroke-dasharray", "4,4"))
    .call(g => g.selectAll("text")
      .attr("fill", "rgba(255,255,255,0.3)")
      .attr("font-size", "11px"))

  svg.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("x", d => x(d.label))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("rx", 6)
    .attr("fill", d => d.color)
    .attr("opacity", revealed ? 1 : 0.4)

  if (revealed) {
    svg.selectAll(".val-label")
      .data(data)
      .join("text")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", d => y(d.value) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "13px")
      .attr("font-weight", "500")
      .attr("fill", "rgba(255,255,255,0.7)")
      .text(d => d.value.toLocaleString() + "k")
  } else {
    svg.selectAll(".question-label")
      .data(data)
      .join("text")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", d => y(50) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("fill", "rgba(255,255,255,0.3)")
      .text("?")
  }
}

async function makeGuess(pick) {
  if (gameState.value !== "playing") return

  const songWins = (song.value.playcount || 0) >= (challenger.value.playcount || 0)
  const correct = (pick === "song" && songWins) || (pick === "challenger" && !songWins)

  gameState.value = correct ? "correct" : "wrong"
  if (correct) {
    score.value++
    streak.value++
  } else {
    streak.value = 0
  }

  await nextTick()
  renderChart(true)
}

async function nextRound() {
  gameState.value = "playing"
  song.value = null
  challenger.value = null
  await loadRound()
}

async function loadRound() {
  loading.value = true
  error.value = ""

  const [a, b] = await Promise.all([fetchRandomTrack(), fetchRandomTrack()])

  if (!a || !b) {
    error.value = "Couldn't load tracks. Retrying..."
    loading.value = false
    setTimeout(loadRound, 1000)
    return
  }

  song.value = a
  challenger.value = b
  audioSrc.value = a.previewUrl
  challengerAudioSrc.value = b.previewUrl
  loading.value = false

  await nextTick()
  renderChart(false)
}

onMounted(() => {
  if (!window.d3) {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"
    script.onload = loadRound
    document.head.appendChild(script)
  } else {
    loadRound()
  }
})
</script>

<template>
  <div
    class="min-h-screen flex flex-col px-7 pt-8 pb-6 transition-colors duration-500"
    :class="song ? GENRE_THEMES[song.genre]?.bg : 'bg-zinc-900'"
  >
    <!-- Score bar -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex flex-col">
        <span class="text-white/30 text-xs uppercase tracking-widest">Score</span>
        <span class="text-white text-2xl font-medium">{{ score }}</span>
      </div>
      <div class="flex flex-col items-end">
        <span class="text-white/30 text-xs uppercase tracking-widest">Streak</span>
        <span class="text-white text-2xl font-medium">{{ streak }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-white/40 text-sm tracking-wide animate-pulse">Loading tracks...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex flex-col items-center justify-center gap-4">
      <p class="text-red-400 text-sm">{{ error }}</p>
    </div>

    <template v-else-if="song && challenger">

      <!-- Prompt -->
      <p class="text-white/50 text-sm text-center mb-5 tracking-wide">
        <span v-if="gameState === 'playing'">Which track has more Last.fm scrobbles?</span>
        <span v-else-if="gameState === 'correct'" class="text-green-400 font-medium">Correct! +1</span>
        <span v-else class="text-red-400 font-medium">Wrong! Streak lost.</span>
      </p>

      <!-- Two track cards -->
      <div class="flex gap-3 mb-6">

        <!-- Song A -->
        <button
          class="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200"
          :class="[
            gameState === 'playing'
              ? 'border-white/10 bg-white/5 hover:bg-white/10 active:scale-95'
              : 'border-white/5 bg-white/5 cursor-default',
            gameState !== 'playing' && song.playcount >= challenger.playcount
              ? 'ring-2 ring-green-500/60'
              : '',
          ]"
          :disabled="gameState !== 'playing'"
          @click="makeGuess('song')"
        >
          <img
            v-if="song.artworkUrl"
            :src="song.artworkUrl"
            class="w-16 h-16 rounded-xl object-cover"
          />
          <div class="text-center">
            <p class="text-white text-sm font-medium leading-tight">{{ song.trackName }}</p>
            <p class="text-white/40 text-xs mt-0.5">{{ song.artistName }}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full" :class="GENRE_THEMES[song.genre]?.badge">
            {{ song.genre }}
          </span>
          <audio :src="audioSrc" autoplay loop class="hidden" />
        </button>

        <!-- VSivider -->
        <div class="flex items-center justify-center">
          <span class="text-white/20 text-lg font-medium">vs</span>
        </div>

        <!-- Song B -->
        <button
          class="flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-200"
          :class="[
            gameState === 'playing'
              ? 'border-white/10 bg-white/5 hover:bg-white/10 active:scale-95'
              : 'border-white/5 bg-white/5 cursor-default',
            gameState !== 'playing' && challenger.playcount > song.playcount
              ? 'ring-2 ring-green-500/60'
              : '',
          ]"
          :disabled="gameState !== 'playing'"
          @click="makeGuess('challenger')"
        >
          <img
            v-if="challenger.artworkUrl"
            :src="challenger.artworkUrl"
            class="w-16 h-16 rounded-xl object-cover"
          />
          <div class="text-center">
            <p class="text-white text-sm font-medium leading-tight">{{ challenger.trackName }}</p>
            <p class="text-white/40 text-xs mt-0.5">{{ challenger.artistName }}</p>
          </div>
          <span class="text-xs px-2 py-0.5 rounded-full" :class="GENRE_THEMES[challenger.genre]?.badge">
            {{ challenger.genre }}
          </span>
          <audio :src="challengerAudioSrc" loop class="hidden" />
        </button>

      </div>

      <div ref="chartEl" class="w-full"></div>

      <button
        v-if="gameState !== 'playing'"
        class="mt-6 w-full py-4 rounded-xl text-sm font-semibold tracking-wide transition-all active:scale-95"
        :class="GENRE_THEMES[song.genre]?.btn1"
        @click="nextRound"
      >
        Next round →
      </button>

    </template>
  </div>
</template>