// 設定頁的 tab 切換：同一路由 /settings 底下切換「個人資料」與「帳號」，
// 對應 frontend-to-workflow 中「同 route 不同 tab 視為不同 Page」的概念。
const buttons = document.querySelectorAll(".tabs button");
const panels = document.querySelectorAll("[data-panel]");

for (const button of buttons) {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;
    for (const b of buttons) {
      b.classList.toggle("active", b === button);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.panel !== tab;
    }
  });
}
