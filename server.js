const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "incidents.json");

app.use(express.json());
app.use(express.static(__dirname));

function loadIncidents() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveIncidents(incidents) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(incidents, null, 2)
  );
}

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

// Calculates the distance between two points on Earth.
function haversine(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;
  const toRadians = degrees => degrees * Math.PI / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * earthRadius * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

app.get("/api/incidents", (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const radius = Number(req.query.radius) || 5;

  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    return res.status(400).json({
      error: "Invalid latitude or longitude."
    });
  }

  if (!Number.isFinite(radius) || radius <= 0) {
    return res.status(400).json({
      error: "Radius must be greater than 0."
    });
  }

  const incidents = loadIncidents();

  const nearby = incidents
    .map(incident => ({
      ...incident,
      distance: haversine(
        lat,
        lon,
        incident.location.lat,
        incident.location.lon
      )
    }))
    .filter(incident => incident.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  res.json(nearby);
});

app.post("/api/incidents", (req, res) => {
  const {
    type,
    description,
    lat,
    lon,
    severity
  } = req.body;

  if (!isValidLatitude(Number(lat)) ||
      !isValidLongitude(Number(lon))) {
    return res.status(400).json({
      error: "Invalid latitude or longitude."
    });
  }

  const validSeverities = ["low", "medium", "high"];

  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      error: "Invalid severity."
    });
  }

  const incidents = loadIncidents();

  const newIncident = {
    id: incidents.length
      ? Math.max(...incidents.map(i => i.id)) + 1
      : 1,
    type: String(type || "unknown").trim(),
    description: String(description || "").trim(),
    location: {
      lat: Number(lat),
      lon: Number(lon)
    },
    timestamp: Date.now(),
    verified: false,
    severity
  };

  incidents.push(newIncident);
  saveIncidents(incidents);

  res.status(201).json(newIncident);
});

app.listen(PORT, () => {
  console.log(`Tolli is running at http://localhost:${PORT}`);
});
