const express = require("express");
const multer = require("multer");
const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const app = express();
const upload = multer({ dest: "uploads/" });

const { state, saveState } = useSingleFileAuthState(path.resolve(__dirname, "creds.json"));
let sock;

async function connect() {
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, printQRInTerminal: false });

  sock.ev.on("creds.update", saveState);

  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      fs.writeFileSync(path.resolve(__dirname, "qr.txt"), update.qr);
      console.log("🔄 QR code updated!");
    }

    if (update.connection === "open") {
      console.log("✅ WhatsApp connected!");
    }

    if (update.connection === "close") {
      console.log("❌ Connection closed, retrying...");
      connect(); // reconnect
    }
  });
}

connect();

app.use(express.static(path.resolve(__dirname, "../frontend")));
app.use(express.json());

app.get("/qr", async (req, res) => {
  const qrPath = path.resolve(__dirname, "qr.txt");
  if (fs.existsSync(qrPath)) {
    const qr = fs.readFileSync(qrPath, "utf-8");
    try {
      const qrBuffer = await QRCode.toBuffer(qr);
      res.type("png").send(qrBuffer);
    } catch (err) {
      res.status(500).send("Error generating QR");
    }
  } else {
    res.status(404).send("QR not available");
  }
});

app.post("/send", upload.fields([{ name: "creds" }, { name: "msg" }]), async (req, res) => {
  if (req.files.creds) {
    fs.copyFileSync(req.files.creds[0].path, path.resolve(__dirname, "creds.json"));
    await connect();
    return res.json({ status: "✅ creds updated" });
  }

  const { target, delay, count } = req.body;

  if (!req.files.msg || !target || !count) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const msg = fs.readFileSync(req.files.msg[0].path, "utf-8");

  for (let i = 0; i < +count; i++) {
    await sock.sendMessage(target + "@s.whatsapp.net", { text: msg });
    await new Promise(r => setTimeout(r, +delay * 1000));
  }

  res.json({ status: "✅ messages sent", count });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
