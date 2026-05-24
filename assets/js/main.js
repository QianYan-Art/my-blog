(function () {
  const texts = ["写代码，写生活。", "记录折腾，也记录成长。", "欢迎来到千颜的博客。"];
  const el = document.querySelector("[data-typewriter]");
  if (!el) return;

  let textIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const current = texts[textIndex];
    if (!deleting) {
      charIndex += 1;
      el.textContent = current.slice(0, charIndex);
      if (charIndex >= current.length) {
        deleting = true;
        setTimeout(tick, 1200);
        return;
      }
      setTimeout(tick, 65);
      return;
    }

    charIndex -= 1;
    el.textContent = current.slice(0, charIndex);
    if (charIndex <= 0) {
      deleting = false;
      textIndex = (textIndex + 1) % texts.length;
      setTimeout(tick, 220);
      return;
    }
    setTimeout(tick, 35);
  }

  setTimeout(tick, 600);
})();
