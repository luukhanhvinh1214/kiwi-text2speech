// Phải chạy đồng bộ ở <head>: áp nền sau lần vẽ đầu thì popup chớp sáng rồi mới tối.
const KHOA_NEN = "kiwi-nen";

function nenDaChon() {
  return localStorage.getItem(KHOA_NEN) || "";
}

function nenDangDung() {
  return nenDaChon() || (matchMedia("(prefers-color-scheme: dark)").matches ? "toi" : "sang");
}

function apDungNen(nen) {
  if (nen) document.documentElement.dataset.nen = nen;
  else delete document.documentElement.dataset.nen;
}

window.kiwiNen = {
  dangDung: nenDangDung,
  doi() {
    const moi = nenDangDung() === "toi" ? "sang" : "toi";
    localStorage.setItem(KHOA_NEN, moi);
    apDungNen(moi);
    return moi;
  }
};

apDungNen(nenDaChon());
