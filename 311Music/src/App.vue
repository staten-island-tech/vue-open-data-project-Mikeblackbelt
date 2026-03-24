<script setup>
import { ref, onMounted, nextTick } from "vue"

const song = ref(null)
const challenger = ref(null)
const audioSrc = ref("")
const challengerAudioSrc = ref("")
const error = ref("")
const loading = ref(false)
const chartEl = ref(null)
const songAudio = ref(null)
const challengerAudio = ref(null)
const isSongPlaying = ref(false)
const gameState = ref("playing")
const score = ref(0)
const streak = ref(0)

const noiseCanvas = ref(null)
const sigLabel = ref(null)
let noiseRaf = null

const GENRE_THEMES = {
  rock:       { bg: "bg-black",       bar1: "#e63030", bar2: "#3f3f3f", badge: "bg-red-600 text-white",      btn1: "bg-red-600 text-white",      btn2: "bg-zinc-800 text-zinc-400" },
  pop:        { bg: "bg-fuchsia-950", bar1: "#e040a0", bar2: "#4a1a3a", badge: "bg-pink-500 text-white",     btn1: "bg-pink-500 text-white",     btn2: "bg-fuchsia-900 text-fuchsia-300" },
  "hip-hop":  { bg: "bg-zinc-950",    bar1: "#b8ff3a", bar2: "#2a3a1a", badge: "bg-lime-400 text-black",     btn1: "bg-lime-400 text-black",     btn2: "bg-zinc-800 text-zinc-400" },
  electronic: { bg: "bg-slate-950",   bar1: "#00c8ff", bar2: "#002244", badge: "bg-cyan-400 text-black",     btn1: "bg-cyan-400 text-black",     btn2: "bg-slate-800 text-slate-400" },
  jazz:       { bg: "bg-amber-950",   bar1: "#f0a020", bar2: "#3a2500", badge: "bg-amber-400 text-black",    btn1: "bg-amber-400 text-black",    btn2: "bg-amber-900 text-amber-400" },
  default:    { bg: "bg-zinc-900",    bar1: "#888780", bar2: "#333",    badge: "bg-zinc-500 text-white",     btn1: "bg-zinc-500 text-white",     btn2: "bg-zinc-800 text-zinc-400" },
}

// ✅ STYLE ONLY
function getGenre(g) {
  if (!g) return "pop"
  const s = g.toLowerCase()

  if (s.includes("rock") || s.includes("metal") || s.includes("punk")) return "rock"
  if (s.includes("pop")) return "pop"
  if (s.includes("hip") || s.includes("rap")) return "hip-hop"
  if (s.includes("electro") || s.includes("edm") || s.includes("dance")) return "electronic"
  if (s.includes('classical')) return 'jazz'
  if (s.includes("jazz") || s.includes("blues") || s.includes("soul")) return "jazz"

  return "pop" // ✅ fallback always pop
}

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
  } catch (err) {
    console.error(err)
    return null
  }
}

async function fetchRandomTrack() {
  for (let attempt = 0; attempt < 10; attempt++) {
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

      const pool = data.results.filter(r => r.previewUrl)
      if (!pool.length) continue

      const result = pool[Math.floor(Math.random() * pool.length)]
      const playcount = await fetchPlaycount(result.artistName, result.trackName)

      if (playcount === null) continue

      return {
        trackName: result.trackName,
        artistName: result.artistName,
        artworkUrl: result.artworkUrl100,
        previewUrl: result.previewUrl,
        genre: getGenre(result.primaryGenreName),
        rawGenre: result.primaryGenreName || "pop", // ✅ added
        playcount,
      }
    } catch (err) {
      console.error(err)
      continue
    }
  }
  return null
}

function renderChart(revealed = false) {
  if (!chartEl.value || !window.d3 || !song.value || !challenger.value) return
  chartEl.value.innerHTML = ""

  const theme = GENRE_THEMES[song.value.genre] || GENRE_THEMES.pop

  const totalWidth = chartEl.value.clientWidth || 360
  const margin = { top: 24, right: 24, bottom: 52, left: 60 }
  const width = totalWidth - margin.left - margin.right
  const height = 300 - margin.top - margin.bottom

  const songK = Math.round((song.value.playcount || 0) / 1000)
  const chalK = Math.round((challenger.value.playcount || 0) / 1000)

  const displayA = revealed ? songK : 50
  const displayB = revealed ? chalK : 50
  const maxVal = revealed ? Math.max(songK, chalK, 1) * 1.3 : 80

  const data = [
    { label: "??????", value: displayA, color: theme.bar1, key: "song" },
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
      .text(d => d.value + "k")
  } else {
    svg.selectAll(".question-label")
      .data(data)
      .join("text")
      .attr("x", d => x(d.label) + x.bandwidth() / 2)
      .attr("y", () => y(50) - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", "18px")
      .attr("fill", "rgba(255,255,255,0.3)")
      .text("?")
  }
}

// ── Signal / static loading effect ──────────────────────────────────────────

function startSignalEffect() {
  if (!noiseCanvas.value) return

  // cancel any in-progress effect
  if (noiseRaf) {
    cancelAnimationFrame(noiseRaf)
    noiseRaf = null
  }

  const canvas = noiseCanvas.value
  const ctx = canvas.getContext("2d")
  const DURATION = 1600
  let startTime = null

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  function resize() {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }

  resize()

  function drawFrame(ts) {
    if (!startTime) startTime = ts
    const rawProgress = Math.min((ts - startTime) / DURATION, 1)
    const progress = easeInOut(rawProgress)

    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    const noiseIntensity = 0.5*(1 - progress)

    if (noiseIntensity > 0.01) {
      const imageData = ctx.createImageData(W, H)
      const data = imageData.data
      const clearFrontY = progress * (H + 60) - 60

      for (let y = 0; y < H; y++) {
        const belowFront = false
        const distFromFront = Math.abs(y - clearFrontY)
        const bandBlend = Math.max(0, 1 - distFromFront / 90)

        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4

          if (belowFront && bandBlend < 0.05) {
            data[i + 3] = 0
            continue
          }

          const grain = Math.random()
          const noiseMix = belowFront ? bandBlend : 1
          const v = Math.floor(grain * 127.5)
          const glitch = !belowFront && Math.random() < 0.002 ? 160 : 0

          data[i]     = v + glitch
          data[i + 1] = v
          data[i + 2] = v + (Math.random() < 0.04 ? 55 : 0)
          data[i + 3] = Math.floor(noiseMix * 235 * (0.65 + grain * 0.35))
        }
      }

      ctx.putImageData(imageData, 0, 0)

      // bright scanline at the clearing edge
      const scanY = clearFrontY + 24
      if (scanY > 0 && scanY < H) {
        const g = ctx.createLinearGradient(0, scanY - 8, 0, scanY + 8)
        g.addColorStop(0, "rgba(255,255,255,0)")
        g.addColorStop(0.5, "rgba(255,255,255,0.6)")
        g.addColorStop(1, "rgba(255,255,255,0)")
        ctx.fillStyle = g
        ctx.fillRect(0, scanY - 8, W, 16)
      }
    }

    // fade "Tuning signal…" label in then out
    if (sigLabel.value) {
      if (rawProgress < 0.25) {
        sigLabel.value.style.opacity = String(rawProgress / 0.25)
      } else if (rawProgress < 0.55) {
        sigLabel.value.style.opacity = "1"
      } else if (rawProgress < 0.8) {
        sigLabel.value.style.opacity = String(1 - (rawProgress - 0.55) / 0.25)
      } else {
        sigLabel.value.style.opacity = "0"
      }
    }

    if (rawProgress < 1) {
      noiseRaf = requestAnimationFrame(drawFrame)
    } else {
      ctx.clearRect(0, 0, W, H)
      if (sigLabel.value) sigLabel.value.style.opacity = "0"
      noiseRaf = null
    }
  }

  noiseRaf = requestAnimationFrame(drawFrame)
}

// ── Game logic ───────────────────────────────────────────────────────────────

async function makeGuess(pick) {
  if (gameState.value !== "playing") return

  const songWins = (song.value.playcount || 0) >= (challenger.value.playcount || 0)
  const correct = (pick === "song" && songWins) || (pick === "challenger" && !songWins)

  gameState.value = correct ? "correct" : "wrong"

  if (songAudio.value) {
    try { songAudio.value.pause(); songAudio.value.currentTime = 0 } catch (e) {}
    isSongPlaying.value = false
  }
  if (challengerAudio.value) challengerAudio.value.play()

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
  if (songAudio.value) { songAudio.value.pause(); songAudio.value.currentTime = 0 }
  if (challengerAudio.value) { challengerAudio.value.pause(); challengerAudio.value.currentTime = 0 }
  isSongPlaying.value = false
  gameState.value = "playing"
  song.value = null
  challenger.value = null
  await loadRound()
}

async function loadRound() {
  loading.value = true
  error.value = ""

  // kick off the signal effect as soon as loading starts
  startSignalEffect()

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

  if (songAudio.value) {
    try {
      const p = songAudio.value.play()
      if (p && p.then) {
        p.then(() => { isSongPlaying.value = true }).catch(() => { isSongPlaying.value = false })
      }
    } catch (e) { isSongPlaying.value = false }
  }
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
    :class="song ? GENRE_THEMES[song.genre || 'pop']?.bg : 'bg-zinc-900'"
  >

    <!-- Signal / static overlay — always in DOM, covers full viewport -->
    <canvas
      ref="noiseCanvas"
      class="fixed inset-0 pointer-events-none"
      style="z-index: 50; width: 100%; height: 100%;"
    />
    <div
      ref="sigLabel"
      class="fixed inset-0 flex items-center justify-center pointer-events-none"
      style="z-index: 51; opacity: 0; font-size: 11px; letter-spacing: 0.18em; color: rgba(255,255,255,0.6); font-family: monospace; text-transform: uppercase;"
    >
      Loading...
    </div>

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
      <p class="text-white/0 text-sm">·</p>
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
            <p class="text-white text-sm font-medium leading-tight">
              {{ gameState !== 'playing' ? song.trackName : '?????' }}
            </p>
            <p class="text-white/40 text-xs mt-0.5">
              {{ gameState !== 'playing' ? song.artistName : '?????' }}
            </p>
            <div class="mt-1">
              <span v-if="isSongPlaying" class="text-emerald-400 text-xs">● playing</span>
            </div>
          </div>
          <audio ref="songAudio" :src="audioSrc" loop class="hidden" />
          <span class="text-xs px-2 py-0.5 rounded-full" :class="GENRE_THEMES[song.genre || 'pop']?.badge">
            {{ song.genre || 'pop' }}
          </span>
        </button>

        <!-- VS divider -->
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
          <audio ref="challengerAudio" :src="challengerAudioSrc" loop class="hidden" />
          <span class="text-xs px-2 py-0.5 rounded-full" :class="GENRE_THEMES[challenger.genre || 'pop']?.badge">
            {{ challenger.genre }}
          </span>
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