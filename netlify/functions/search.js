import fetch from "node-fetch";

export const handler = async (event) => {
  try {
    const q = event.queryStringParameters?.q || "system of a down";
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=67`
    );

    if (!response.ok) throw new Error(`iTunes error: ${response.status}`);
    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};