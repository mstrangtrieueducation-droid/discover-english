const MOBILE_QUERY = "(max-width: 900px), (pointer: coarse)";

function driveViewUrl(id) {
  return `https://drive.google.com/file/d/${id}/view?usp=sharing`;
}

function loadInlinePlayer(shell) {
  if (shell.querySelector("iframe")) return;
  const iframe = document.createElement("iframe");
  iframe.src = `https://drive.google.com/file/d/${shell.dataset.driveId}/preview`;
  iframe.title = shell.dataset.title;
  iframe.allow = "autoplay; encrypted-media; fullscreen";
  iframe.allowFullscreen = true;
  iframe.loading = "lazy";
  shell.replaceChildren(iframe);
}

function renderVideo(shell) {
  if (!window.matchMedia(MOBILE_QUERY).matches) {
    loadInlinePlayer(shell);
    return;
  }

  const card = document.createElement("div");
  card.className = "video-fallback";

  const title = document.createElement("strong");
  title.textContent = shell.dataset.title;

  const note = document.createElement("p");
  note.textContent = "Trên điện thoại và iPad, con mở video trực tiếp để xem ổn định hơn.";

  const actions = document.createElement("div");
  actions.className = "video-actions";

  const link = document.createElement("a");
  link.className = "video-link";
  link.href = driveViewUrl(shell.dataset.driveId);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "▶ Mở video";

  const button = document.createElement("button");
  button.className = "inline-button";
  button.type = "button";
  button.textContent = "Thử phát ngay trong trang";
  button.addEventListener("click", () => loadInlinePlayer(shell));

  actions.append(link, button);
  card.append(title, note, actions);
  shell.replaceChildren(card);
}

document.querySelectorAll(".video-shell").forEach(renderVideo);
