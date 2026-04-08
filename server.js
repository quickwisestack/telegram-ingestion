import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// 🧠 Extract helper
function extractField(line, key) {
  if (!line.includes(key)) return "";
  return line.split(":")[1]?.trim() || "";
}

// 🔥 VALIDATE LINK
function isValidLink(link) {
  if (!link) return false;
  if (link.length < 10) return false;
  if (link.includes("linkedin.com/in")) return false;
  if (link === "http://Wipro") return false;
  return true;
}

// 🔥 PARSE TELEGRAM MESSAGE
function parseJobs(message) {
  const jobs = [];
  const blocks = message.split("━━━━━━━━━━━━━━━");
  const seen = new Set();

  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim());

    let job = {
      title: "",
      company: "",
      location: "",
      salary: "",
      experience: "",
      qualification: "",
      apply_link: "",
      source: "telegram"
    };

    for (const line of lines) {
      if (line.includes("Company")) {
        job.company = extractField(line, "Company");
      }

      if (line.includes("Role")) {
        job.title = extractField(line, "Role");
      }

      if (line.includes("Location")) {
        job.location = extractField(line, "Location");
      }

      if (line.includes("Salary")) {
        job.salary = extractField(line, "Salary");
      }

      if (line.includes("Experience")) {
        job.experience = extractField(line, "Experience");
      }

      if (line.includes("Qualification")) {
        job.qualification = extractField(line, "Qualification");
      }

      if (line.includes("http")) {
        job.apply_link = line.trim();
      }
    }

    // 🧠 Fix missing title
    if (!job.title) {
      job.title = job.company + " Job";
    }

    // ❌ Skip invalid
    if (!isValidLink(job.apply_link)) continue;

    // ❌ Skip duplicates
    if (seen.has(job.apply_link)) continue;
    seen.add(job.apply_link);

    jobs.push(job);
  }

  return jobs;
}

async function saveJob(job) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(job)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Supabase Insert Error:", data);
      return false;
    }

    console.log("✅ DB Inserted:", job.company);
    return true;

  } catch (err) {
    console.error("❌ Fetch Error:", err.message);
    return false;
  }
}

app.post("/telegram", async (req, res) => {
  console.log("📩 Telegram webhook HIT");

  res.sendStatus(200); // respond fast

  (async () => {
    try {
      const message = req.body.message?.text || req.body.channel_post?.text;
      if (!message) return;

      console.log("📩 Message:", message);

      const jobs = parseJobs(message);

   for (const job of jobs) {
  const ok = await saveJob(job);

  if (ok) {
    console.log("✅ Saved:", job.company);
  } else {
    console.log("❌ Not saved:", job.company);
  }
}
    } catch (err) {
      console.error(err);
    }
  })();
});
// ✅ ROOT CHECK
app.get("/", (req, res) => {
  res.send("Telegram ingestion running ✅");
});

// ✅ TELEGRAM TEST ROUTE (GET)
app.get("/telegram", (req, res) => {
  res.send("Telegram webhook endpoint ready ✅");
});
app.listen(3000, () => {
  console.log("🚀 Telegram ingestion service running");
});
