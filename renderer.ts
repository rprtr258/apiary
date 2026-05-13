const information = document.getElementById("info")!;
information.innerText = [
  `This app is using Chrome (v${window.versions.chrome()})`,
  `Node.js (v${window.versions.node()})`,
  `and Electron (v${window.versions.electron()})`,
].join(", ");
const n = document.createElement("button");
n.addEventListener("click", async () => {
  await window.api.getData();
});
n.innerText = "SOSAL";
document.body.appendChild(n);
