import { put } from "@vercel/blob";

const maxMessageLength = 5000;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8kb",
    },
  },
};

function respond(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ message }));
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    respond(response, 405, "This request is not supported.");
    return;
  }

  const message = request.body?.message;
  if (typeof message !== "string" || !message.trim()) {
    respond(response, 400, "Write a little note before sending it.");
    return;
  }
  if (message.trim().length > maxMessageLength) {
    respond(response, 413, "Please keep your note under 5,000 characters.");
    return;
  }

  try {
    const note = Buffer.from(message.trim(), "utf8");
    await put("graduation-letters/anna-joseph/reply.txt", note, {
      access: "private",
      addRandomSuffix: true,
      contentType: "text/plain; charset=utf-8",
    });
    respond(response, 200, "Your note is saved.");
  } catch (error) {
    console.error("Could not save Anna's letter.", error);
    if (!response.headersSent) {
      respond(response, 503, "Keepsake storage is unavailable. Please try again later.");
    }
  }
}
