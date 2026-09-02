function driveViewUrl(id) {
  return `https://drive.google.com/file/d/${id}/view?usp=sharing`;
}

function loadInlinePlayer(shell) {
  if (shell.querySelector("iframe")) return;
  const iframe = document.createElement("iframe");
  iframe.src = `https://drive.google.com/file/d/${shell.dataset.driveId}/preview`;
  iframe.title = shell.dataset.title;
  iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
  iframe.allowFullscreen = true;
  iframe.loading = "eager";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  shell.replaceChildren(iframe);
}

function renderVideo(shell) {
  loadInlinePlayer(shell);
}

document.querySelectorAll(".video-shell").forEach(renderVideo);
