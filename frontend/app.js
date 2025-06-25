async function refreshQR() {
  const resp = await fetch("/qr");
  if (resp.ok) {
    const blob = await resp.blob();
    document.getElementById("qrimg").src = URL.createObjectURL(blob);
  }
}

setInterval(refreshQR, 2000);

document.getElementById("start").onclick = async () => {
  const mode = document.getElementById("mode").value;
  const data = new FormData();
  data.append("target", document.getElementById("target").value);
  data.append("delay", document.getElementById("delay").value);
  data.append("count", document.getElementById("count").value);
  data.append("msg", document.getElementById("msg").files[0]);
  if (mode === "creds") {
    data.append("creds", document.getElementById("creds").files[0]);
  }

  const resp = await fetch("/send", { method: "POST", body: data });
  alert(await resp.json().status);
};
