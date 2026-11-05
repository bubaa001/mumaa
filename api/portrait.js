import { pipeline } from "node:stream/promises";
import { get, put } from "@vercel/blob";

const portraitPath = "graduation-photos/anna-joseph/portrait";
const maxPortraitBytes = 4 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const config = {
  api: {
    bodyParser: false,
  },
};

function respond(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify({ message }));
}

function hasExpectedSignature(buffer, contentType) {
  if (contentType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return contentType === "image/webp" &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

async function readPortrait(request, response) {
  const contentType = request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
  if (!supportedTypes.has(contentType)) {
    respond(response, 415, "Choose a JPEG, PNG, or WebP photo.");
    return;
  }

  const contentLength = Number(request.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxPortraitBytes) {
    respond(response, 413, "That photo is too large. Choose one under 4 MB.");
    return;
  }

  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += data.length;
    if (size > maxPortraitBytes) {
      tooLarge = true;
      continue;
    }
    chunks.push(data);
  }

  if (tooLarge) {
    respond(response, 413, "That photo is too large. Choose one under 4 MB.");
    return;
  }

  const image = Buffer.concat(chunks);
  if (!hasExpectedSignature(image, contentType)) {
    respond(response, 415, "That photo could not be opened. Choose another image.");
    return;
  }

  await put(portraitPath, image, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  });
  respond(response, 200, "Your photo is saved.");
}

async function downloadPortrait(response) {
  const portrait = await get(portraitPath, { access: "private", useCache: false });
  if (!portrait || portrait.statusCode !== 200 || !portrait.stream) {
    respond(response, 404, "There is no saved photo yet.");
    return;
  }

  response.statusCode = 200;
  response.setHeader("Content-Type", portrait.blob.contentType);
  response.setHeader("Content-Length", String(portrait.blob.size));
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[portrait.blob.contentType] || "jpg";
  response.setHeader("Content-Disposition", `attachment; filename="anna-joseph-graduation-portrait.${extension}"`);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  await pipeline(portrait.stream, response);
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    respond(response, 405, "This request is not supported.");
    return;
  }

  try {
    if (request.method === "POST") {
      await readPortrait(request, response);
    } else {
      await downloadPortrait(response);
    }
  } catch (error) {
    console.error("Could not complete private portrait request.", error);
    if (!response.headersSent) {
      respond(response, 503, "Keepsake storage is unavailable. Please try again later.");
    }
  }
}
