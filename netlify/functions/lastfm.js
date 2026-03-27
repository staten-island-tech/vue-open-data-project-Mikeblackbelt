
export const handler = async (event) => {
  try {
    const { artist, track } = event.queryStringParameters || {};

    if (!artist || !track) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "artist and track are required" }),
      };
    }

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${process.env.LASTFM_KEY}&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&format=json&autocorrect=4`,
      {
        headers: {
          "User-Agent": "MyMusicApp/1.0 (youremail@example.com)",
        },
      }
    );

    if (!response.ok) throw new Error(`Last.fm error: ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Last.fm: ${data.message}`);

    return {
      statusCode: 200,
      body: JSON.stringify({ playcount: data.track?.playcount ?? null }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};