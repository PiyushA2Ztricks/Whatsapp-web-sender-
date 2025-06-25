const express = require("express");
const multer = require("multer");
const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

const [state, saveState] = useSingleFileAuthState(path.resolve(__dirname, "creds.json"));
let sock;

async function connect() {
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, printQRInTerminal: false });
  sock.ev.on("creds.update", saveState);
  sock.ev.on("connection.update", update => {
    if (update.qr) {
      fs.writeFileSync(path.resolve(__dirname, "qr.txt"), update.qr);
    }
  });
}

connect();

app.use(express.static(path.resolve(__dirname, "../frontend")));
app.use(express.json());

app.get("/qr", (req, res) => {
  if (fs.existsSync("qr.txt")) {
    res.type("png");
    const qr = fs.readFileSync("qr.txt", "utf-8");
    require("qrcode").toBuffer(qr).then(buf => res.send(buf));
  } else res.status(404).send("QR not available");
});

app.post("/send", upload.fields([{ name: "creds" }, { name: "msg" }]), async (req, res) => {
  if (req.files.creds) {
    fs.copyFileSync(req.files.creds[0].path, "creds.json");
    connect();
    return res.json({ status: "creds_saved" });
  }
  const { target, delay, count } = req.body;
  const msg = fs.readFileSync(req.files.msg[0].path, "utf-8");
  for (let i = 0; i < +count; i++) {
    await sock.sendMessage(target + "@s.whatsapp.net", { text: msg });
    await new Promise(r => setTimeout(r, +delay * 1000));
  }
  res.json({ status: "sent", count });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on", PORT));
