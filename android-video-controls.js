(function () {
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isAppleMobile = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isAppleMobile) return;

  var videoSelector = [
    'iframe[src*="drive.google.com/file/d/"]',
    'iframe[src*="youtube.com/embed/"]',
    'iframe[src*="youtube-nocookie.com/embed/"]'
  ].join(",");
  var formLinkSelector = [
    'a[href*="docs.google.com/forms"]',
    'a[href*="forms.gle"]',
    'a[data-form-link]',
    'a[data-google-form-url]',
    'a.form-link',
    'a.submit-link'
  ].join(",");
  var activeFormTouch = null;
  var lastTouchNavigation = 0;
  var nativeFormNavigation = false;

  function directVideoUrl(iframe) {
    var source = iframe.getAttribute("src") || "";
    var youtubeMatch = source.match(/youtube(?:-nocookie)?\.com\/embed\/([^?&#/]+)/i);
    if (youtubeMatch) return "https://www.youtube.com/watch?v=" + youtubeMatch[1];
    return source;
  }

  function stopPlayer(shell) {
    var iframe = shell.querySelector(":scope > iframe");
    if (!iframe) return;

    var source = iframe.dataset.androidVideoSource || iframe.getAttribute("src");
    iframe.dataset.androidVideoSource = source;
    iframe.setAttribute("src", "about:blank");
    requestAnimationFrame(function () {
      iframe.setAttribute("src", source);
    });

    shell.classList.remove("video-enabled");
    var button = shell.querySelector(":scope > .android-video-toggle");
    if (button) {
      button.setAttribute("aria-pressed", "false");
      button.textContent = "Bật video";
    }
  }

  function buildControls(iframe) {
    var parent = iframe.parentElement;
    if (!parent || parent.querySelector(":scope > .video-access-toggle")) return;

    var shell = parent;
    var siblingIframes = parent.querySelectorAll(":scope > iframe");
    if (siblingIframes.length !== 1) {
      shell = document.createElement("div");
      parent.insertBefore(shell, iframe);
      shell.appendChild(iframe);
    }
    shell.classList.add("android-video-shell");
    iframe.dataset.androidVideoSource = iframe.getAttribute("src") || "";

    var button = document.createElement("button");
    button.className = "android-video-toggle";
    button.type = "button";
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Bật video";
    button.addEventListener("click", function () {
      if (shell.classList.contains("video-enabled")) {
        stopPlayer(shell);
        return;
      }

      document.querySelectorAll(".android-video-shell.video-enabled").forEach(stopPlayer);
      shell.classList.add("video-enabled");
      button.setAttribute("aria-pressed", "true");
      button.textContent = "Dừng video";
    });

    var link = document.createElement("a");
    link.className = "android-video-open";
    link.href = directVideoUrl(iframe);
    link.target = "_top";
    link.textContent = "Mở video toàn màn hình";
    link.addEventListener("click", function (event) {
      event.preventDefault();
      try {
        window.top.location.assign(link.href);
      } catch (error) {
        window.location.assign(link.href);
      }
    });

    shell.appendChild(button);
    shell.appendChild(link);
  }

  function isGoogleFormLink(link) {
    var href = originalFormUrl(link);
    try {
      var url = new URL(href, window.location.href);
      return (url.hostname === "docs.google.com" && url.pathname.indexOf("/forms/") === 0)
        || url.hostname === "forms.gle";
    } catch (error) {
      return false;
    }
  }

  function originalFormUrl(link) {
    return (link.dataset && link.dataset.googleFormUrl) || link.href || "";
  }

  function closestFormLink(target) {
    var link = target && target.closest ? target.closest(formLinkSelector) : null;
    return link && isGoogleFormLink(link) ? link : null;
  }

  function prepareFormLinks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(formLinkSelector)) prepareFormLink(scope);
    scope.querySelectorAll(formLinkSelector).forEach(function (link) {
      prepareFormLink(link);
    });
  }

  function prepareFormLink(link) {
    var formUrl = originalFormUrl(link);
    if (link.dataset && !link.dataset.googleFormUrl) link.dataset.googleFormUrl = formUrl;
    // Open Forms in a separate in-app page so Google is not loaded inside an iframe.
    if (link.href !== formUrl) link.href = formUrl;
    link.target = "_blank";
    link.rel = "noopener";
  }

  function movedTooFar(touch, start) {
    var deltaX = touch.clientX - start.x;
    var deltaY = touch.clientY - start.y;
    return (deltaX * deltaX) + (deltaY * deltaY) > 144;
  }

  function navigateToForm(link) {
    var formUrl = originalFormUrl(link);
    link.href = formUrl;
    link.target = "_blank";
    link.rel = "noopener";

    nativeFormNavigation = true;
    try {
      link.click();
    } finally {
      nativeFormNavigation = false;
    }
  }

  prepareFormLinks(document);

  if (isAndroid) {
    document.documentElement.classList.add("android-video-device");
    document.querySelectorAll(videoSelector).forEach(buildControls);

    document.addEventListener("touchstart", function (event) {
      var link = closestFormLink(event.target);
      if (!link || event.touches.length !== 1) {
        activeFormTouch = null;
        return;
      }

      var touch = event.touches[0];
      activeFormTouch = {
        link: link,
        x: touch.clientX,
        y: touch.clientY,
        startedAt: Date.now()
      };
    }, { capture: true, passive: true });

    document.addEventListener("touchmove", function (event) {
      if (!activeFormTouch || !event.touches.length) return;
      if (movedTooFar(event.touches[0], activeFormTouch)) activeFormTouch = null;
    }, { capture: true, passive: true });

    document.addEventListener("touchcancel", function () {
      activeFormTouch = null;
    }, { capture: true, passive: true });

    document.addEventListener("touchend", function (event) {
      if (!activeFormTouch || !event.changedTouches.length) return;

      var candidate = activeFormTouch;
      activeFormTouch = null;
      if (movedTooFar(event.changedTouches[0], candidate)) return;
      if (Date.now() - candidate.startedAt > 800) return;
      if (!isGoogleFormLink(candidate.link)) return;

      event.preventDefault();
      event.stopPropagation();
      lastTouchNavigation = Date.now();
      navigateToForm(candidate.link);
    }, { capture: true, passive: false });

    document.addEventListener("click", function (event) {
      if (nativeFormNavigation) return;
      var link = closestFormLink(event.target);
      if (!link) return;

      event.preventDefault();
      event.stopPropagation();
      if (Date.now() - lastTouchNavigation < 1000) return;
      navigateToForm(link);
    }, true);
  }

  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "attributes") {
        prepareFormLinks(mutation.target.parentElement || document);
        return;
      }
      mutation.addedNodes.forEach(prepareFormLinks);
    });
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["href"],
    childList: true,
    subtree: true
  });
}());
