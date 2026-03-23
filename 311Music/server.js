import express from "express"
import fetch from "node-fetch"
import dotenv from "dotenv"

dotenv.config()

const app = express()

app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q || "system of a down"
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=67`
    )
    if (!response.ok) throw new Error(`iTunes error: ${response.status}`)
    const data = await response.json()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get("/api/lastfm", async (req, res) => {
  try {
    const { artist, track } = req.query
    if (!artist || !track) {
      return res.status(400).json({ error: "artist and track are required" })
    }

    console.log("KEY:", process.env.LASTFM_KEY)
    console.log("artist:", artist, "track:", track)

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${process.env.LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json&autocorrect=4`,
      {
        headers: {
          "User-Agent": "MyMusicApp/1.0 (youremail@example.com)"
        }
      }
    )

    if (!response.ok) throw new Error(`Last.fm error: ${response.status}`)
    const data = await response.json()
    console.log("Last.fm response:", JSON.stringify(data))
    if (data.error) throw new Error(`Last.fm: ${data.message}`)
    res.json({ playcount: data.track?.playcount ?? null })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(3001, () => console.log("API server running on http://localhost:3001"))